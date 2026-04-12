from collections import defaultdict
from .models import Participant

def get_balances(user=None, group_id=None):
    balances = defaultdict(float)

    participants = Participant.objects.all()

    if user:
        participants = participants.filter(receipt__group__members=user)

    if group_id:
        participants = participants.filter(receipt__group_id=group_id)

    for p in participants:
        balance = p.amount_paid - p.amount_owed
        balances[p.user.username] += balance

    return dict(balances)

def calculate_settlement(receipt):
    participants = Participant.objects.filter(receipt=receipt)

    balances = []

    for p in participants:
        balance = p.amount_paid - p.amount_owed
        balances.append({
            'user': p.user,
            'balance': balance
        })

    creditors = [b for b in balances if b['balance'] > 0]
    debtors = [b for b in balances if b['balance'] < 0]

    transactions = []

    i, j = 0, 0

    while i < len(debtors) and j < len(creditors):
        debt = -debtors[i]['balance']
        credit = creditors[j]['balance']

        amount = min(debt, credit)

        transactions.append({
            'from': debtors[i]['user'],
            'to': creditors[j]['user'],
            'amount': round(amount, 2)
        })

        debtors[i]['balance'] += amount
        creditors[j]['balance'] -= amount

        if abs(debtors[i]['balance']) < 0.01:
            i += 1
        if abs(creditors[j]['balance']) < 0.01:
            j += 1

    return transactions