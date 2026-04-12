from datetime import datetime
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.decorators import login_required
from .models import Receipt, Participant, User

def register(request):
    if request.method == 'POST':
        form = UserCreationForm(request.POST)
        if form.is_valid():
            form.save()
            return redirect('login')
    else:
        form = UserCreationForm()
    return render(request, 'register.html', {'form': form})

@login_required
def create_receipt(request):
    users = User.objects.all()

    if request.method == 'POST':
        title = request.POST['title']
        total = float(request.POST['total'])

        participant_ids = request.POST.getlist('participants')
        payer_id = request.POST['payer']
        split_type = request.POST['split_type']

        receipt = Receipt.objects.create(
            title=title,
            total_amount=total,
            created_by=request.user,
            split_type=split_type
        )

        participants = []
        for uid in participant_ids:
            p = Participant.objects.create(
                receipt=receipt,
                user_id=uid
            )
            participants.append(p)

        if len(participants) == 0:
            return redirect('create_receipt')

        if split_type == 'equal':
            share = total / len(participants)
            for p in participants:
                p.amount_owed = share

        elif split_type == 'custom':
            for p in participants:
                amount = request.POST.get(f'amount_{p.user.id}')
                p.amount_owed = float(amount) if amount else 0

        elif split_type == 'percentage':
            for p in participants:
                percent = request.POST.get(f'percent_{p.user.id}')
                percent = float(percent) if percent else 0
                p.amount_owed = total * percent / 100

        for p in participants:
            if str(p.user.id) == payer_id:
                p.amount_paid = total
            else:
                p.amount_paid = 0

            p.save()

        return redirect('dashboard')

    return render(request, 'create_receipt.html', {'users': users})

@login_required
def dashboard(request):
    group_id = request.GET.get('group')

    if group_id:
        receipts = Receipt.objects.filter(group_id=group_id)
    else:
        receipts = Receipt.objects.filter(created_by=request.user)

    return render(request, 'dashboard.html', {
        'receipts': receipts
    })

@login_required
def profile(request):
    return render(request, 'profile.html')

@login_required
def receipt_detail(request, receipt_id):
    receipt = get_object_or_404(Receipt, id=receipt_id)
    participants = Participant.objects.filter(receipt=receipt)

    return render(request, 'receipt_detail.html', {
        'receipt': receipt,
        'participants': participants
    })

@login_required
def edit_receipt(request, receipt_id):
    receipt = get_object_or_404(Receipt, id=receipt_id)
    participants = Participant.objects.filter(receipt=receipt)

    if request.method == 'POST':
        receipt.title = request.POST['title']
        receipt.total_amount = float(request.POST['total'])
        receipt.save()

        for p in participants:
            paid = request.POST.get(f'paid_{p.user.id}')
            owed = request.POST.get(f'owed_{p.user.id}')

            p.amount_paid = float(paid) if paid else 0
            p.amount_owed = float(owed) if owed else 0
            p.save()

        return redirect('receipt_detail', receipt_id=receipt.id)

    return render(request, 'edit_receipt.html', {
        'receipt': receipt,
        'participants': participants
    })