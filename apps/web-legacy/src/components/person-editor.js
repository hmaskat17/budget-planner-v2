import { personStore } from '../person-store.js';

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
    :host {
        display: block;
        margin-bottom: 4px;
    }
    input {
        font: inherit;
        border: none;
        border-bottom: 1px solid transparent;
        background: transparent;
        padding: 0;
    }
    input:focus {
        border-bottom-color: #4a90d9;
        outline: none;
    }
`);

/** Edits a person's shared display name; any component can mount this for the same person-id. */
export class PersonEditor extends HTMLElement {
    static get observedAttributes() {
        return ['person-id'];
    }

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.adoptedStyleSheets = [sheet];
    }

    connectedCallback() {
        this._unsubscribe = personStore.subscribe(() => this.render());
        this.render();
    }

    disconnectedCallback() {
        this._unsubscribe?.();
    }

    attributeChangedCallback() {
        if (this.isConnected) {
            this.render();
        }
    }

    render() {
        const person = personStore.get(this.getAttribute('person-id'));
        if (!person) {
            return;
        }
        const existingInput = this.shadowRoot.querySelector('input');
        // Skip rebuilding while this editor's own input is focused; it already shows the typed value.
        if (existingInput && this.shadowRoot.activeElement === existingInput) {
            return;
        }
        this.shadowRoot.innerHTML = '';
        const input = document.createElement('input');
        input.type = 'text';
        input.value = person.name;
        input.setAttribute('aria-label', 'Person name');
        input.addEventListener('input', () => personStore.rename(person.id, input.value));
        this.shadowRoot.appendChild(input);
    }
}

customElements.define('person-editor', PersonEditor);
