import {
    addAttributes,
    addClass,
    removeAttributes,
    removeClass,
    setDisplayStyle
} from './dom_utils';

export function getLoadingActionCallable(element: HTMLElement|SVGElement, actionName: string, arg = ''): () => void {
    const loadingAction = parseLoadingAction(actionName, false);

    return getLoadingCallable(loadingAction, element, arg);
}

export function getReverseActionCallable(element: HTMLElement|SVGElement, actionName: string, arg = ''): () => void {
    const loadingAction = parseLoadingAction(actionName, true);

    return getLoadingCallable(loadingAction, element, arg);
}

const parseLoadingAction = function(action: string, isReversed: boolean) {
    switch (action) {
        case 'show':
            return isReversed ? 'show' : 'hide';
        case 'hide':
            return isReversed ? 'hide' : 'show';
        case 'addClass':
            return isReversed ? 'addClass' : 'removeClass';
        case 'removeClass':
            return isReversed ? 'removeClass' : 'addClass';
        case 'addAttribute':
            return isReversed ? 'addAttribute' : 'removeAttribute';
        case 'removeAttribute':
            return isReversed ? 'removeAttribute' : 'addAttribute';
    }

    throw new Error(`Unknown data-loading action "${action}"`);
}

const getLoadingCallable = function(finalAction: string, element: HTMLElement|SVGElement, arg: string): () => void {
    switch (finalAction) {
        case 'show':
            return () => {
                setDisplayStyle(element, 'inline-block');
            };

        case 'hide':
            return () => {
                setDisplayStyle(element, 'none');
            };

        case 'addClass':
            return () => addClass(element, [arg]);

        case 'removeClass':
            return () => removeClass(element, [arg]);

        case 'addAttribute':
            return () => addAttributes(element, [arg]);

        case 'removeAttribute':
            return () => removeAttributes(element, [arg]);

        default:
            throw new Error(`Unknown data-loading action "${finalAction}"`);
    }
}
