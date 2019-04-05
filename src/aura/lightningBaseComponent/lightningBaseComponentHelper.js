({

    /*Toast helpers*/
    notification: function () {

        return {

            shortToastShowTime: 4000,

            longToastShowTime: 8000,

            showToast(params) {
                const toastEvent = $A.get("e.force:showToast");
                toastEvent.setParams(params);
                toastEvent.fire();
            },

            showQuickToast(type, title, message) {
                this.showToast({
                    "type": type,
                    "title": title,
                    "message": message,
                    "mode": "dismissible",
                    "duration": this.shortToastShowTime
                });
            },

            showLongToast(type, title, message) {
                this.showToast({
                    "type": type,
                    "title": title,
                    "message": message,
                    "mode": "dismissible",
                    "duration": this.longToastShowTime
                });
            },

            showQuickErrorToast(message) {
                this.showQuickToast(
                    "error",
                    "Something went wrong!",
                    message
                );
            },

            showQuickSuccessToast(message) {
                this.showQuickToast(
                    "success",
                    "Success!",
                    message
                );
            },

            showLongErrorToast(message) {
                this.showLongToast(
                    "error",
                    "Something went wrong!",
                    message
                );
            },

            showLongSuccessToast(message) {
                this.showLongToast(
                    "success",
                    "Success!",
                    message
                );
            }
        }
    },

    /* Libraries getter */
    libraries: function () {

        const helper = this;

        const hasLibrary = (cmp, libraryName) => {
            const library = cmp.find(libraryName);
            return !$A.util.isUndefinedOrNull(library);
        };

        const getLibrary = (cmp, libraryName) => {
            const library = cmp.find(libraryName);
            const lightningPromise = helper.server().getLightningPromise();
            return new lightningPromise(resolve => {
                resolve(library);
            });
        };

        const createLibrary = (cmp, libraryName, params) => {
            const lightningPromise = helper.server().getLightningPromise();
            return helper.component().create(libraryName, params)
                .then(library => {
                    library = library[0];
                    let body = cmp.get("v.body");
                    if ($A.util.isUndefinedOrNull(body)) {
                        body = [];
                    }
                    body.push(library);
                    cmp.set("v.body", body);
                    return new lightningPromise((resolve, reject) => {
                        resolve(library);
                    });
                });
        };

        return {

            getNotifyLibrary(cmp, libraryIdName) {
                libraryIdName = libraryIdName || "notifyLib";
                if (hasLibrary(cmp, libraryIdName)) {
                    return getLibrary(cmp, libraryIdName)
                }
                return createLibrary(cmp,
                    "lightning:notificationsLibrary",
                    {"aura:id": libraryIdName}
                );
            },

            getNavigationLibrary(cmp, libraryIdName) {
                libraryIdName = libraryIdName || "navigationLib";
                if (hasLibrary(cmp, libraryIdName)) {
                    return getLibrary(cmp, libraryIdName)
                }
                return createLibrary(cmp,
                    "lightning:navigation",
                    {"aura:id": libraryIdName}
                );
            }
        }
    },

    /* Server interactions and utilities */
    server: function () {

        const helper = this;

        const getAction = (cmp, actionName, params) => {
            if (actionName.indexOf("c.") <= -1) {
                actionName = "c." + actionName;
            }

            const action = cmp.get(actionName);
            if (!$A.util.isUndefinedOrNull(params)) {
                action.setParams(params);
            }
            return action;
        };

        return {

            getLightningPromise() {
                return class LightningPromise extends Promise {

                    constructor(fn) {
                        super($A.getCallback(fn));
                    }

                    then(onSuccess, onError) {
                        return super.then(
                            (onSuccess ? $A.getCallback(onSuccess) : undefined),
                            (onError ? $A.getCallback(onError) : undefined)
                        );
                    }

                    catch(onError) {
                        return super.catch(
                            onError ? $A.getCallback(onError) : undefined
                        );
                    }

                    finally(onFinally) {
                        return super.finally(
                            onFinally ? $A.getCallback(onFinally) : undefined
                        );
                    }
                }
            },

            executePromise(cmp, actionName, params) {
                const action = getAction(cmp, actionName, params);
                const lightningPromise = this.getLightningPromise();
                return new lightningPromise((resolve, reject) => {
                    action.setCallback(this, result => {
                        let state = result.getState();
                        if (state === "SUCCESS") {
                            resolve(result.getReturnValue());
                        } else {
                            reject(result);
                        }
                    });
                    $A.enqueueAction(action);
                });
            },

            execute(cmp, actionName, params, successCallback, errorCallback, finallyCallback) {
                const action = getAction(cmp, actionName, params);
                action.setCallback(this, result => {
                    let state = result.getState();
                    if (state === "SUCCESS") {
                        if (!$A.util.isUndefinedOrNull(successCallback)) {
                            successCallback(result.getReturnValue());
                        }
                    } else {
                        if (!$A.util.isUndefinedOrNull(errorCallback)) {
                            errorCallback(result);
                        }
                    }
                    if (!$A.util.isUndefinedOrNull(finallyCallback)) {
                        finallyCallback();
                    }
                });
                $A.enqueueAction(action);
            },

            showQuickErrorToast(response) {
                const message = this.parseMessage(response);
                helper.notification().showQuickErrorToast(message);
            },

            showLongErrorToast(response) {
                const message = this.parseMessage(response);
                helper.notification().showLongErrorToast(message)
            },

            parseMessage: function (response) {
                if (typeof response === 'string') {
                    return response;
                }
                const state = response.getState();
                let message = "Unknown error.";
                if (state === "ERROR") {
                    let errors = response.getError();
                    if (errors && errors[0] && errors[0].message) {
                        message = errors[0].message;
                    }
                } else if (state === "INCOMPLETE") {
                    message = "No response from server or client is offline.";
                }
                return message;
            },
        }
    },

    /* File interaction utilities */
    file: function () {

        const helper = this;

        return {

            download(base64file, fileName) {
                const a = document.createElement("a");
                a.href = window.URL.createObjectURL(this.base64ToBlob(base64file));
                a.download = fileName;
                a.rel = "noopener";
                a.target = '_blank';
                a.click();
            },

            base64ToBlob(b64Data) {
                let sliceSize = 512;
                let byteCharacters = atob(b64Data);
                let byteArrays = [];
                for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
                    let slice = byteCharacters.slice(offset, offset + sliceSize);
                    let byteNumbers = new Array(slice.length);
                    for (var i = 0; i < slice.length; i++) {
                        byteNumbers[i] = slice.charCodeAt(i);
                    }
                    let byteArray = new Uint8Array(byteNumbers);
                    byteArrays.push(byteArray);
                }
                return new Blob(byteArrays, {type: "application/octet-stream"});
            },

            blobToBase64(blob) {
                const lightningPromise = helper.getLightningPromise();
                return new lightningPromise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(blob);
                    reader.onloadend = (event) => {
                        const error = event.target.error;
                        if (!$A.util.isUndefinedOrNull(error)) {
                            reject(error);
                            return;
                        }
                        resolve(event.target.result);
                    };
                });
            },
        }
    },

    /* Component creation utilities */
    component: function () {

        const helper = this;

        return {

            create(params) {
                if (!$A.util.isArray(params)) {
                    params = [[params, arguments[1]]];
                }
                const lightningPromise = helper.server().getLightningPromise();
                return new lightningPromise((resolve, reject) => {
                    $A.createComponents(params, (components, status, errorMessage) => {
                        if (status === "SUCCESS") {
                            resolve(components);
                        } else {
                            reject(errorMessage, status);
                        }
                    });
                });
            },
        }
    },

    /* Utilities */
    util: function () {

        return {

            flatten: function (array) {
                const flattenObject = function (object) {
                    const result = {};
                    for (const prop in object) {
                        if (!object.hasOwnProperty(prop)) continue;
                        if ((typeof object[prop]) === "object") {
                            const flatObject = this.flatten(object[prop]);
                            for (const x in flatObject) {
                                if (!flatObject.hasOwnProperty(x)) continue;
                                result[prop + '.' + x] = flatObject[x];
                            }
                        } else {
                            result[prop] = object[prop];
                        }
                    }
                    return result;
                }

                if (!$A.util.isArray(array)) {
                    return flattenObject(array);
                }

                return array.map(item => {
                    return flattenObject(item);
                });
            },

            hash: function (obj) {
                const stringObj = JSON.stringify(obj);
                let hash = 0, i, chr;
                if (stringObj.length === 0) return hash;
                for (let i = 0; i < stringObj.length; i++) {
                    chr = stringObj.charCodeAt(i);
                    hash = ((hash << 5) - hash) + chr;
                    hash |= 0; // Convert to 32bit integer
                }
                return hash;
            },

            clone: function (object) {
                return JSON.parse(JSON.stringify(object));
            }
        }
    }
})