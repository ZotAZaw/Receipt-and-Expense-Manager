from django.db import models
from django.utils import timezone
from django.contrib.auth.models import User

class Group(models.Model):
    name = models.CharField(max_length=255)
    members = models.ManyToManyField(User)

    def __str__(self):
        return self.name

class Receipt(models.Model):
    title = models.CharField(max_length=255)
    total_amount = models.FloatField()
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    receipt_time = models.DateTimeField(default=timezone.now)
    SPLIT_CHOICES = [
        ('equal', 'Equal'),
        ('custom', 'Custom'),
        ('percentage', 'Percentage'),
    ]
    split_type = models.CharField(
        max_length=20,
        choices=[
            ('equal', 'Equal'),
            ('custom', 'Custom'),
            ('percentage', 'Percentage'),
        ],
        default='equal'
    )
    group = models.ForeignKey(Group, on_delete=models.CASCADE, null=True, blank=True)

class Participant(models.Model):
    receipt = models.ForeignKey(Receipt, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    amount_owed = models.FloatField(default=0)
    amount_paid = models.FloatField(default=0)
