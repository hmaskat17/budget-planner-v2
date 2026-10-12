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
        const total = [...document.querySelectorAll(tagName)]
            .reduce((sum, component) => sum + (typeof component.total === 'function' ? component.total() : 0), 0);
        el.textContent = total.toFixed(2);
    }

    document.addEventListener(eventName, update);
    update();
}

