export default class UnsyncedInputContainer {
    #mappedFields: Map<string, HTMLElement>;
    #unmappedFields: Array<HTMLElement> = [];
    modelNames: string[] = [];

    constructor() {
        this.#mappedFields = new Map();
    }

    add(element: HTMLElement, modelName: string|null = null) {
        if (modelName) {
            this.#mappedFields.set(modelName, element);
            if (!this.modelNames.includes(modelName)) {
                this.modelNames.push(modelName);
            }

            return;
        }

        this.#unmappedFields.push(element);
    }

    all() {
        return [...this.#unmappedFields, ...this.#mappedFields.values()]
    }

    allMappedFields(): Map<string, HTMLElement> {
        return this.#mappedFields;
    }

    remove(modelName: string) {
        this.#mappedFields.delete(modelName);
        this.modelNames = this.modelNames.filter(m => m !== modelName);
    }
}
