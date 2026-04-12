from django.urls import path
from . import views

urlpatterns = [
    path('', views.dashboard, name='dashboard'),
    path('receipt/<int:receipt_id>/', views.receipt_detail, name='receipt_detail'),
    path('receipt/<int:receipt_id>/edit/', views.edit_receipt, name='edit_receipt'),
    path('register/', views.register, name='register'),
    path('create/', views.create_receipt, name='create_receipt'),
    path('accounts/profile/', views.profile, name='profile'),
]