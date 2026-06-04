# Receipt & Expense Manager

## Giới thiệu

Hệ thống quản lý chi tiêu cá nhân và nhóm được xây dựng nhằm hỗ trợ người dùng theo dõi các khoản chi tiêu, quản lý công nợ và phân chia chi phí giữa các thành viên một cách minh bạch và hiệu quả.

### Chức năng chính

* Đăng ký / Đăng nhập tài khoản
* Quản lý thông tin cá nhân
* Tạo và quản lý nhóm chi tiêu
* Quản lý thành viên trong nhóm
* Tạo khoản chi và ghi nhận người thanh toán
* Chia chi phí theo nhiều phương thức
* Quản lý công nợ giữa các thành viên
* Tạo và xác nhận thanh toán
* Thống kê và theo dõi chi tiêu

---

## Công nghệ sử dụng

* **Frontend**: ReactJS + Vite
* **Backend**: Supabase
* **Database**: PostgreSQL
* **Authentication**: Supabase Auth
* **Styling**: Tailwind CSS
* **State Management**: React Hooks

---

## Yêu cầu hệ thống

* Node.js >= 18
* npm hoặc yarn
* Git (optional)

---

## Cài đặt môi trường

### 1. Clone project

```bash
git clone https://github.com/ZotAZaw/Receipt-and-Expense-Manager.git
cd Receipt-and-Expense-Manager
```

### 2. Cài đặt thư viện

```bash
npm install
```

hoặc

```bash
yarn install
```

### 3. Cấu hình môi trường

Tạo file `.env`:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

### 4. Chạy ứng dụng

```bash
npm run dev
```

hoặc

```bash
yarn dev
```

Mở trình duyệt:

```text
http://localhost:5173
```

---

## Chức năng chính

### Authentication

* Đăng ký tài khoản
* Đăng nhập
* Đăng xuất
* Xác thực người dùng bằng Supabase Auth

### Profile

* Cập nhật thông tin cá nhân
* Thay đổi ảnh đại diện
* Quản lý thông tin người dùng

### Group Management

* Tạo nhóm chi tiêu
* Chỉnh sửa thông tin nhóm
* Thêm thành viên vào nhóm
* Xóa thành viên khỏi nhóm
* Quản lý quyền thành viên

### Expense Management

* Tạo khoản chi mới
* Ghi nhận người thanh toán
* Chia chi phí theo:

  * Chia đều
  * Theo số tiền cụ thể
  * Theo phần trăm
* Chỉnh sửa khoản chi
* Xóa khoản chi

### Payment Management

* Tạo giao dịch thanh toán
* Xác nhận thanh toán
* Từ chối thanh toán
* Theo dõi lịch sử thanh toán

### Statistics

* Thống kê tổng chi tiêu
* Theo dõi công nợ thành viên
* Xem báo cáo chi tiêu theo nhóm

---

## Cấu trúc thư mục

```text
src/
├── components/
├── pages/
├── hooks/
├── services/
├── contexts/
├── lib/
├── types/
├── utils/
└── assets/
```

---
