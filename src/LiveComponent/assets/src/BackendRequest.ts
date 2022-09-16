import UnsyncedInputContainer from './UnsyncedInputContainer';

export default class BackendRequest {
    readonly promise: Promise<any>;
    readonly unsyncedInputContainer: UnsyncedInputContainer;
    #isPromiseResolved = false;
    readonly action: null|string;

    constructor(promise: Promise<any>, unsyncedInputContainer: UnsyncedInputContainer, action: string|null) {
        this.promise = promise;
        this.promise.then((data) => {
            this.#isPromiseResolved = true;

            return data;
        });
        this.unsyncedInputContainer = unsyncedInputContainer;
        this.action = action;
    }

    addModifiedElement(element: HTMLElement, modelName: string|null = null): void {
        this.unsyncedInputContainer.add(element, modelName);
    }

    isResolved() {
        return this.#isPromiseResolved;
    }
}
