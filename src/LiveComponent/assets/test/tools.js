import { Application } from 'stimulus';
import LiveController from '../src/live_controller';
import { waitFor } from '@testing-library/dom';

const TestData = class {
    constructor(controller, element) {
        this.controller = controller;
        this.element = element;
    }
}

let application;

const startStimulus = async (html, container = null) => {
    // start the Stimulus app just once per test suite
    if (!application) {
        application = Application.start();
        application.register('live', LiveController);
    }

    if (!container) {
        container = document.createElement('div');
    }

    container.innerHTML = html;
    document.body.appendChild(container);

    const element = getControllerElement(container);
    await waitFor(() => application.getControllerForElementAndIdentifier(element, 'live'));
    const controller = application.getControllerForElementAndIdentifier(element, 'live');

    return new TestData(controller, element);
};

const getControllerElement = (container) => {
    return container.querySelector('[data-controller="live"]');
};

const dataToJsonAttribute = (data) => {
    const container = document.createElement('div');
    container.dataset.foo = JSON.stringify(data);

    // returns the now-escaped string, ready to be used in an HTML attribute
    return container.outerHTML.match(/data\-foo="(.+)\"/)[1]
}

const initLiveComponent = (url, data) => {
    return `
        data-controller="live"
        data-live-url-value="http://localhost${url}"
        data-live-data-value="${dataToJsonAttribute(data)}"
    `;
}

export { startStimulus, getControllerElement, initLiveComponent };
