/**
 * Wires up a total display that sums `.total()` across every mounted element matching `tagName`,
 * refreshed whenever `eventName` fires.
 * @param {{ tagName: string, eventName: string, totalElementId: string }} config
 */
export function createTotalAggregator({ tagName, eventName, totalElementId }) {
    function update() {
        const el = document.getElementById(totalElementId);
        if (!el) {
            return;
        }
        // Household totals exclude settlements, which only move money between persons.
        const total = [...document.querySelectorAll(tagName)].reduce((sum, component) => {
            if (typeof component.baseTotal === 'function') {
                return sum + component.baseTotal();
            }
            return sum + (typeof component.total === 'function' ? component.total() : 0);
        }, 0);
        el.textContent = total.toFixed(2);
    }

    document.addEventListener(eventName, update);
    update();
}

