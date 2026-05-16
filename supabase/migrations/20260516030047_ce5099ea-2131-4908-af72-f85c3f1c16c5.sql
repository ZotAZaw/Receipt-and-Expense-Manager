
-- Enums
CREATE TYPE public.split_method AS ENUM ('equal', 'exact', 'percent', 'fund');
CREATE TYPE public.member_role AS ENUM ('owner', 'admin', 'member');
CREATE TYPE public.payment_status AS ENUM ('pending', 'accepted', 'rejected', 'reverted');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Groups
CREATE TABLE public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fund_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- Members
CREATE TABLE public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.member_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- Helper functions (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_group_member(_gid UUID, _uid UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = _gid AND user_id = _uid);
$$;

CREATE OR REPLACE FUNCTION public.is_group_admin(_gid UUID, _uid UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = _gid AND user_id = _uid AND role IN ('owner','admin'));
$$;

-- Group policies
CREATE POLICY "groups_select_member" ON public.groups FOR SELECT TO authenticated
  USING (public.is_group_member(id, auth.uid()));
CREATE POLICY "groups_insert_self" ON public.groups FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "groups_update_admin" ON public.groups FOR UPDATE TO authenticated
  USING (public.is_group_admin(id, auth.uid()));
CREATE POLICY "groups_delete_owner" ON public.groups FOR DELETE TO authenticated
  USING (auth.uid() = owner_id);

-- Member policies
CREATE POLICY "members_select_member" ON public.group_members FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "members_insert_admin_or_self_for_new_group" ON public.group_members FOR INSERT TO authenticated
  WITH CHECK (
    public.is_group_admin(group_id, auth.uid())
    OR (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.groups WHERE id = group_id AND owner_id = auth.uid()))
  );
CREATE POLICY "members_update_admin" ON public.group_members FOR UPDATE TO authenticated
  USING (public.is_group_admin(group_id, auth.uid()));
CREATE POLICY "members_delete_admin_or_self" ON public.group_members FOR DELETE TO authenticated
  USING (public.is_group_admin(group_id, auth.uid()) OR auth.uid() = user_id);

-- Bills
CREATE TABLE public.bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  total_amount NUMERIC(14,2) NOT NULL CHECK (total_amount > 0),
  paid_by UUID REFERENCES auth.users(id), -- null when paid from fund
  split_method public.split_method NOT NULL,
  bill_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bills_select_member" ON public.bills FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "bills_insert_member" ON public.bills FOR INSERT TO authenticated
  WITH CHECK (public.is_group_member(group_id, auth.uid()) AND auth.uid() = created_by);
CREATE POLICY "bills_update_creator_or_admin" ON public.bills FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR public.is_group_admin(group_id, auth.uid()));
CREATE POLICY "bills_delete_creator_or_admin" ON public.bills FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR public.is_group_admin(group_id, auth.uid()));

-- Bill splits (who owes how much for a bill)
CREATE TABLE public.bill_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  percentage NUMERIC(5,2),
  UNIQUE(bill_id, user_id)
);
ALTER TABLE public.bill_splits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "splits_select_member" ON public.bill_splits FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bills b WHERE b.id = bill_id AND public.is_group_member(b.group_id, auth.uid())));
CREATE POLICY "splits_insert_member" ON public.bill_splits FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.bills b WHERE b.id = bill_id AND public.is_group_member(b.group_id, auth.uid())));
CREATE POLICY "splits_update_member" ON public.bill_splits FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bills b WHERE b.id = bill_id AND public.is_group_member(b.group_id, auth.uid())));
CREATE POLICY "splits_delete_member" ON public.bill_splits FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bills b WHERE b.id = bill_id AND public.is_group_member(b.group_id, auth.uid())));

-- Payments (offer/accept settlement)
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  from_user UUID NOT NULL REFERENCES auth.users(id),
  to_user UUID NOT NULL REFERENCES auth.users(id),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  status public.payment_status NOT NULL DEFAULT 'pending',
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  CHECK (from_user <> to_user)
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments_select_member" ON public.payments FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "payments_insert_self" ON public.payments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = from_user AND public.is_group_member(group_id, auth.uid()));
CREATE POLICY "payments_update_party" ON public.payments FOR UPDATE TO authenticated
  USING (auth.uid() IN (from_user, to_user));
CREATE POLICY "payments_delete_sender" ON public.payments FOR DELETE TO authenticated
  USING (auth.uid() = from_user AND status = 'pending');

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-add creator as owner member when group is created
CREATE OR REPLACE FUNCTION public.handle_new_group()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_group_created
  AFTER INSERT ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_group();

CREATE INDEX idx_bills_group ON public.bills(group_id, bill_date DESC);
CREATE INDEX idx_splits_bill ON public.bill_splits(bill_id);
CREATE INDEX idx_splits_user ON public.bill_splits(user_id);
CREATE INDEX idx_payments_group ON public.payments(group_id, created_at DESC);
CREATE INDEX idx_members_user ON public.group_members(user_id);
