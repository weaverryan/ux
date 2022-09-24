import Backend, {BackendAction} from './Backend';
import ValueStore from './ValueStore';
import { normalizeModelName } from './string_utils';
import BackendRequest from "./BackendRequest";
import LoadingHelper from "./LoadingHelper";
import {
    getValueFromElement, htmlToElement,
} from "./dom_utils";
import {executeMorphdom} from "./morphdom";
import UnsyncedInputsTracker from "./UnsyncedInputsTracker";
import {ModelElementResolver} from "./ModelElementResolver";

declare const Turbo: any;

export default class Component {
    readonly element: HTMLElement;
    private readonly backend: Backend;
    readonly valueStore: ValueStore;
    private readonly unsyncedInputsTracker: UnsyncedInputsTracker;
    private readonly loadingHelper: LoadingHelper;

    defaultDebounce = 150;

    private originalData = {};
    private backendRequest: BackendRequest|null;
    /** Actions that are waiting to be executed */
    private pendingActions: BackendAction[] = [];
    /** Is a request waiting to be made? */
    private isRequestPending = false;
    /** Current "timeout" before the pending request should be sent. */
    private requestDebounceTimeout: number | null = null;
    pollingIntervals: NodeJS.Timer[] = [];

    /**
     * @param element The root element
     * @param data    Component data
     * @param backend Backend instance for updating
     * @param modelElementResolver Class to get "model" name from any element.
     */
    constructor(element: HTMLElement, data: any, backend: Backend, modelElementResolver: ModelElementResolver) {
        console.log('CONSTRUCT');
        this.element = element;
        this.backend = backend;

        this.valueStore = new ValueStore(data);
        this.unsyncedInputsTracker = new UnsyncedInputsTracker(element, modelElementResolver);
        this.loadingHelper = new LoadingHelper();

        // deep clone the data
        this.snapshotOriginalData();
        // hide "loading" elements to begin with
        // This is done with CSS, but only for the most basic cases
        this.loadingHelper.finishLoading(this.element);
    }

    connect(): void {
        // TODO: restart existing polls
        this.unsyncedInputsTracker.activate();
    }

    disconnect(): void {
        this.stopAllPolling();
        this.clearRequestDebounceTimeout();
        this.unsyncedInputsTracker.deactivate();
    }

    // TODO: return a promise
    set(model: string, value: any, reRender = false, debounce: number|boolean = false): void {
        console.log('set', model, value, reRender, this.isRequestPending);
        const modelName = normalizeModelName(model);
        this.valueStore.set(modelName, value);

        // if there is a "validatedFields" data, it means this component wants
        // to track which fields have been / should be validated.
        // in that case, when the model is updated, mark that it should be validated
        // TODO: could this be done with a hook?
        if (this.valueStore.has('validatedFields')) {
            const validatedFields = [...this.valueStore.get('validatedFields')];
            if (!validatedFields.includes(modelName)) {
                validatedFields.push(modelName);
            }
            this.valueStore.set('validatedFields', validatedFields);
        }

        // the model's data is no longer unsynced
        this.unsyncedInputsTracker.markModelAsSynced(modelName);

        if (!reRender) {
            return;
        }

        this.debouncedStartRequest(debounce);
    }

    get(model: string): any {
        const modelName = normalizeModelName(model);
        if (!this.valueStore.has(modelName)) {
            throw new Error(`Invalid model "${model}".`);
        }

        return this.valueStore.get(modelName);
    }

    // TODO: return promise
    action(name: string, args: any, debounce: number|boolean = false): void {
        this.pendingActions.push({
            name,
            args
        });

        this.debouncedStartRequest(debounce);
    }

    // TODO return a promise
    render(): void {
        console.log('RENDER');
        this.tryStartingRequest();
    }

    startPoll(actionName: string, duration: number) {
        let callback: () => void;
        if (actionName === '$render') {
            callback = () => {
                this.render();
            }
        } else {
            callback = () => {
                this.action(actionName, {}, 0);
            }
        }

        const timer = setInterval(() => {
            callback();
        }, duration);
        this.pollingIntervals.push(timer);
    }

    getUnsyncedModels(): string[] {
        return this.unsyncedInputsTracker.getModifiedModels();
    }

    private tryStartingRequest(): void {
        console.log('tryStartingRequest');
        if (!this.backendRequest) {
            this.performRequest()

            return;
        }

        // mark that a request is wanted
        this.isRequestPending = true;
    }

    private performRequest(): BackendRequest {
        console.log('START REQUEST', this.valueStore.all());
        this.backendRequest = this.backend.makeRequest(
            this.valueStore.all(),
            this.pendingActions,
            this.valueStore.updatedModels
        );
        this.loadingHelper.startLoading(this.element, this.backendRequest);

        this.pendingActions = [];
        this.valueStore.updatedModels = [];
        this.isRequestPending = false;
        console.log('isRequestPending before', this.isRequestPending);
        setTimeout(() => {
            console.log('0ms later', this.isRequestPending);
        }, 0);

        this.backendRequest.promise.then((response) => {
            console.log('FINISH LOADING');
            response.text().then((html) => {
                console.log('isRequestPending', this.isRequestPending);
                this.processRerender(html, response);
                console.log('FINISH RE_RENDER');

                this.backendRequest = null;

                // do we already have another request pending?
                if (this.isRequestPending) {
                    this.isRequestPending = false;
                    this.performRequest();
                }
            });

            return response;
        });

        return this.backendRequest;
    }

    private processRerender(html: string, response: Response) {
        // check if the page is navigating away
        //if (this.isWindowUnloaded) {
        // TODO: bring back windowUnloaded
        if (html === 'fooobar') {
            return;
        }

        if (response.headers.get('Location')) {
            // action returned a redirect
            if (typeof Turbo !== 'undefined') {
                Turbo.visit(response.headers.get('Location'));
            } else {
                window.location.href = response.headers.get('Location') || '';
            }

            return;
        }

        // remove the loading behavior now so that when we morphdom
        // "diffs" the elements, any loading differences will not cause
        // elements to appear different unnecessarily
        this.loadingHelper.finishLoading(this.element);

        if (!this.dispatchEvent('live:render', html, true, true)) {
            // preventDefault() was called
            return;
        }

        /**
         * For any models modified since the last request started, grab
         * their value now: we will re-set them after the new data from
         * the server has been processed.
         */
        const modifiedModelValues: any = {};
        this.valueStore.updatedModels.forEach((modelName) => {
            modifiedModelValues[modelName] = this.valueStore.get(modelName);
        });

        const newElement = htmlToElement(html);
        // normalize new element into non-loading state before diff
        this.loadingHelper.finishLoading(newElement);

        // TODO: maybe abstract where the new data comes from
        const newDataFromServer: any = JSON.parse(newElement.dataset.liveDataValue as string);
        executeMorphdom(
            this.element,
            newElement,
            this.unsyncedInputsTracker.getUnsyncedInputs(),
            (element: HTMLElement) => getValueFromElement(element, this.valueStore),
            this.originalData,
            this.valueStore.all(),
            newDataFromServer
        );
        // TODO: could possibly do this by listening to the dataValue value change
        this.valueStore.reinitialize(newDataFromServer);

        // take a new snapshot of the "original data"
        this.snapshotOriginalData();

        // reset the modified values back to their client-side version
        Object.keys(modifiedModelValues).forEach((modelName) => {
            this.valueStore.set(modelName, modifiedModelValues[modelName]);
        });

        // TODO: put this back in live_controller.ts, via a promise or hook system
        //this.modelSynchronizer.synchronizeValueOfModelFields();
    }

    private dispatchEvent(name: string, payload: any = null, canBubble = true, cancelable = false) {
        return this.element.dispatchEvent(new CustomEvent(name, {
            bubbles: canBubble,
            cancelable,
            detail: payload
        }));
    }

    private snapshotOriginalData() {
        this.originalData = JSON.parse(JSON.stringify(this.valueStore.all()));
    }

    private caculateDebounce(debounce: number|boolean): number {
        if (debounce === true) {
            return this.defaultDebounce;
        }

        if (debounce === false) {
            return 0;
        }

        return debounce;
    }

    private clearRequestDebounceTimeout() {
        if (this.requestDebounceTimeout) {
            clearTimeout(this.requestDebounceTimeout);
            this.requestDebounceTimeout = null;
        }
    }

    private debouncedStartRequest(debounce: number|boolean) {
        this.clearRequestDebounceTimeout();
        this.requestDebounceTimeout = window.setTimeout(() => {
            this.render();
        }, this.caculateDebounce(debounce));
    }

    private stopAllPolling(): void {
        this.pollingIntervals.forEach((interval) => {
            clearInterval(interval);
        });
    }
}
