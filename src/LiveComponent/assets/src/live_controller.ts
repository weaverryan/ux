import { Controller } from '@hotwired/stimulus';
import { parseDirectives, DirectiveModifier } from './directives_parser';
import { normalizeModelName } from './string_utils';
import {
    getModelDirectiveFromElement,
    getElementAsTagText,
} from './dom_utils';
import Component from "./Component";
import Backend from "./Backend";

interface UpdateModelOptions {
    dispatch?: boolean;
    debounce?: number|boolean;
}

export interface LiveController {
    dataValue: any;
    element: Element,
    childComponentControllers: Array<LiveController>
}

export default class extends Controller implements LiveController {
    static values = {
        url: String,
        data: Object,
        csrf: String,
        /**
         * The Debounce timeout.
         *
         * Default: 150
         */
        debounce: { type: Number, default: 150 },
    }

    readonly urlValue!: string;
    dataValue!: any;
    readonly csrfValue!: string;
    readonly hasDebounceValue: boolean;
    readonly debounceValue: number;

    component: Component;

    /**
     * Current "timeout" before the pending request should be sent.
     */
    requestDebounceTimeout: number | null = null;

    isWindowUnloaded = false;

    mutationObserver: MutationObserver|null = null;

    childComponentControllers: Array<LiveController> = [];

    pendingActionTriggerModelElement: HTMLElement|null = null;

    initialize() {
        // TODO / fix/replace all of this
        this.markAsWindowUnloaded = this.markAsWindowUnloaded.bind(this);
        this.handleUpdateModelEvent = this.handleUpdateModelEvent.bind(this);
        this.handleConnectedControllerEvent = this.handleConnectedControllerEvent.bind(this);
        this.handleDisconnectedControllerEvent = this.handleDisconnectedControllerEvent.bind(this);

        if (!(this.element instanceof HTMLElement)) {
            throw new Error('Invalid Element Type');
        }
        console.log('INIT COMPONENT');
        this.component = new Component(
            this.element,
            this.dataValue,
            new Backend(this.urlValue, this.csrfValue)
        );
        if (this.hasDebounceValue) {
            this.component.defaultDebounce = this.debounceValue;
        }
    }

    connect() {
        this.component.connect();
        // hide "loading" elements to begin with
        // This is done with CSS, but only for the most basic cases

        // helps typescript be sure this is an HTMLElement, not just Element
        if (!(this.element instanceof HTMLElement)) {
            throw new Error('Invalid Element Type');
        }

        window.addEventListener('beforeunload', this.markAsWindowUnloaded);
        this._startAttributesMutationObserver();
        this.element.addEventListener('live:update-model', this.handleUpdateModelEvent);

        this.element.addEventListener('live:connect', this.handleConnectedControllerEvent);

        this._dispatchEvent('live:connect', { controller: this });
    }

    disconnect() {
        this.component.disconnect();
        this.#clearRequestDebounceTimeout();

        window.removeEventListener('beforeunload', this.markAsWindowUnloaded);
        this.element.removeEventListener('live:update-model', this.handleUpdateModelEvent);
        this.element.removeEventListener('live:connect', this.handleConnectedControllerEvent);
        this.element.removeEventListener('live:disconnect', this.handleDisconnectedControllerEvent);

        this._dispatchEvent('live:disconnect', { controller: this });

        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
        }
    }

    /**
     * Called to update one piece of the model.
     *
     *      <button data-action="live#update" data-model="foo" data-value="5">
     */
    update(event: any) {
        if (event.type === 'input' || event.type === 'change') {
            throw new Error(`Since LiveComponents 2.3, you no longer need data-action="live#update" on form elements. Found on element: ${getElementAsTagText(event.target)}`);
        }

        this.component.setValueFromElement(event.target);
    }

    action(event: any) {
        // using currentTarget means that the data-action and data-action-name
        // must live on the same element: you can't add
        // data-action="click->live#action" on a parent element and
        // expect it to use the data-action-name from the child element
        // that actually received the click
        const rawAction = event.currentTarget.dataset.actionName;

        // data-action-name="prevent|debounce(1000)|save"
        const directives = parseDirectives (rawAction);
        let debounce: number|boolean = false;

        directives.forEach((directive) => {
            const validModifiers: Map<string, (modifier: DirectiveModifier) => void> = new Map();
            validModifiers.set('prevent', () => {
                event.preventDefault();
            });
            validModifiers.set('stop', () => {
                    event.stopPropagation();
            });
            validModifiers.set('self', () => {
                if (event.target !== event.currentTarget) {
                    return;
                }
            });
            validModifiers.set('debounce', (modifier: DirectiveModifier) => {
                debounce = modifier.value ? parseInt(modifier.value) : true;
            });

            directive.modifiers.forEach((modifier) => {
                if (validModifiers.has(modifier.name)) {
                    // variable is entirely to make ts happy
                    const callable = validModifiers.get(modifier.name) ?? (() => {});
                    callable(modifier);

                    return;
                }

                console.warn(`Unknown modifier ${modifier.name} in action "${rawAction}". Available modifiers are: ${Array.from(validModifiers.keys()).join(', ')}.`);
            });

            this.component.action(directive.action, directive.named, debounce);

            // TODO: fix this
            // possible case where this element is also a "model" element
            // if so, to be safe, slightly delay the action so that the
            // change/input listener on LiveController can process the
            // model change *before* sending the action
            if (getModelDirectiveFromElement(event.currentTarget, false)) {
                this.pendingActionTriggerModelElement = event.currentTarget;
                this.#clearRequestDebounceTimeout();
            }
        })
    }

    $render() {
        this.component.render();
    }

    /**
     * Update a model value.
     *
     * The extraModelName should be set to the "name" attribute of an element
     * if it has one. This is only important in a parent/child component,
     * where, in the child, you might be updating a "foo" model, but you
     * also want this update to "sync" to the parent component's "bar" model.
     * Typically, setup on a field like this:
     *
     *      <input data-model="foo" name="bar">
     *
     * @param {string} model The model to update
     * @param {any} value The new value
     * @param {boolean} shouldRender Whether a re-render should be triggered
     * @param {string|null} extraModelName Another model name that this might go by in a parent component.
     * @param {UpdateModelOptions} options
     */
    $updateModel(model: string, value: any, shouldRender = true, extraModelName: string|null = null, options: UpdateModelOptions = {}) {
        const modelName = normalizeModelName(model);
        const normalizedExtraModelName = extraModelName ? normalizeModelName(extraModelName) : null;

        // TODO: support this again
        if (options.dispatch !== false) {
            this._dispatchEvent('live:update-model', {
                modelName,
                extraModelName: normalizedExtraModelName,
                value
            });
        }

        this.component.set(model, value, shouldRender, options.debounce);
    }

    markAsWindowUnloaded = () => {
        this.isWindowUnloaded = true;
    };

    handleConnectedControllerEvent(event: any) {
        if (event.target === this.element) {
            return;
        }

        this.childComponentControllers.push(event.detail.controller);
        // live:disconnect needs to be registered on the child element directly
        // that's because if the child component is removed from the DOM, then
        // the parent controller is no longer an ancestor, so the live:disconnect
        // event would not bubble up to it.
        event.detail.controller.element.addEventListener('live:disconnect', this.handleDisconnectedControllerEvent);
    }

    handleDisconnectedControllerEvent(event: any) {
        if (event.target === this.element) {
            return;
        }

        const index = this.childComponentControllers.indexOf(event.detail.controller);

        // Remove value from an array
        if (index > -1) {
            this.childComponentControllers.splice(index, 1);
        }
    }

    handleUpdateModelEvent(event: any) {
        // ignore events that we dispatched
        if (event.target === this.element) {
            return;
        }

        this._handleChildComponentUpdateModel(event);
    }

    _handleChildComponentUpdateModel(event: any) {
        // TODO: fix this
        return;
        const mainModelName = event.detail.modelName;
        const potentialModelNames = [
            { name: mainModelName, required: false },
        ];
        if (event.detail.extraModelName) {
            potentialModelNames.push({ name: event.detail.extraModelName, required: false });
        }

        const modelMapElement = event.target.closest('[data-model-map]');
        if (this.element.contains(modelMapElement)) {
            const directives = parseDirectives(modelMapElement.dataset.modelMap);

            directives.forEach((directive) => {
                let from = null;
                directive.modifiers.forEach((modifier) => {
                    switch (modifier.name) {
                        case 'from':
                            if (!modifier.value) {
                                throw new Error(`The from() modifier requires a model name in data-model-map="${modelMapElement.dataset.modelMap}"`);
                            }
                            from = modifier.value;

                            break;
                        default:
                            console.warn(`Unknown modifier "${modifier.name}" in data-model-map="${modelMapElement.dataset.modelMap}".`);
                    }
                });

                if (!from) {
                    throw new Error(`Missing from() modifier in data-model-map="${modelMapElement.dataset.modelMap}". The format should be "from(childModelName)|parentModelName"`);
                }

                // only look maps for the model currently being updated
                if (from !== mainModelName) {
                    return;
                }

                potentialModelNames.push({ name: directive.action, required: true });
            });
        }

        potentialModelNames.reverse();
        let foundModelName: string | null = null;
        potentialModelNames.forEach((potentialModel) => {
            if (foundModelName) {
                return;
            }

            if (this.valueStore.hasAtTopLevel(potentialModel.name)) {
                foundModelName = potentialModel.name;

                return;
            }

            if (potentialModel.required) {
                throw new Error(`The model name "${potentialModel.name}" does not exist! Found in data-model-map="from(${mainModelName})|${potentialModel.name}"`);
            }
        });

        if (!foundModelName) {
            return;
        }

        this.$updateModel(
            foundModelName,
            event.detail.value,
            false,
            null,
            {
                dispatch: false
            }
        );
    }

    /**
     * Helps "re-normalize" certain root element attributes after a re-render.
     *
     *      1) Re-establishes the data-original-data attribute if missing.
     *      2) Stops or re-initializes data-poll
     *
     * This happens if a parent component re-renders a child component
     * and morphdom *updates* child. This commonly happens if a parent
     * component is around a list of child components, and changing
     * something in the parent causes the list to change. In that case,
     * the child component might be removed while another is added.
     * But to morphdom, this sometimes looks like an "update". The result
     * is that the child component is re-rendered, but the child component
     * is not re-initialized. And so, the data-original-data attribute
     * is missing and never re-established.
     */
    _startAttributesMutationObserver() {
        if (!(this.element instanceof HTMLElement)) {
            throw new Error('Invalid Element Type');
        }
        const element : HTMLElement = this.element;

        this.mutationObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                // TODO: fix this
                return;
                /*
                if (mutation.type === 'attributes') {
                    if (!element.dataset.originalData) {
                        this.originalDataJSON = this.valueStore.asJson();
                        this._exposeOriginalData();
                    }

                    this._initiatePolling();
                }
                 */
            });
        });

        this.mutationObserver.observe(this.element, {
            attributes: true
        });
    }

    #clearRequestDebounceTimeout() {
        // clear any pending renders
        if (this.requestDebounceTimeout) {
            clearTimeout(this.requestDebounceTimeout);
            this.requestDebounceTimeout = null;
        }
    }

    _dispatchEvent(name: string, payload: any = null, canBubble = true, cancelable = false) {
        return this.element.dispatchEvent(new CustomEvent(name, {
            bubbles: canBubble,
            cancelable,
            detail: payload
        }));
    }
}
