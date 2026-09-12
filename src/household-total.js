/** Aggregates totals across all mounted budget-income components into the household total. */
function updateHouseholdTotal() {
    const el = document.getElementById('household-total-amount');
    if (!el) {
        return;
    }
    const total = [...document.querySelectorAll('budget-income')]
        .reduce((sum, component) => sum + (typeof component.total === 'function' ? component.total() : 0), 0);
    el.textContent = total.toFixed(2);
}

document.addEventListener('income-changed', updateHouseholdTotal);
updateHouseholdTotal();
