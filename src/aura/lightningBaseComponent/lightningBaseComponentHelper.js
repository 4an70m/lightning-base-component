/**
 * Created by 4an70 on 1/21/2019.
 */
({
    /* Toast helpers */
    notification: function() {
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
        };
    },

    /* Libraries getter */
    libraries: function() {

        const helper = this;

        return {
            getNotifyLibrary(cmp) {
                const notifyLibrary = cmp.find("notifyLib");
                const lightningPromise = helper.server().getLightningPromise();

                if (!$A.util.isUndefinedOrNull(notifyLibrary)) {
                    return new lightningPromise((resolve, reject) => {
                        resolve(notifyLibrary);
                    });
                }
                return helper.component().create(
                    "lightning:notificationsLibrary",
                    {"aura:id": "notifyLib"}
                ).then(notifyLibComponent => {
                    notifyLibComponent = notifyLibComponent[0];
                    let body = cmp.get("v.body");
                    if ($A.util.isUndefinedOrNull(body)) {
                        body = [];
                    }
                    body.push(notifyLibComponent);
                    cmp.set("v.body", body);
                    return new lightningPromise((resolve, reject) => {
                        resolve(notifyLibComponent);
                    });
                });

            }
        }
    },

    /* Server interactions and utilities */
    server: function () {

        const helper = this;

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

            execute(cmp, actionName, params) {
                if (actionName.indexOf("c.") <= -1) {
                    actionName = "c." + actionName;
                }

                const lightningPromise = this.getLightningPromise();
                return new lightningPromise((resolve, reject) => {
                    const action = cmp.get(actionName);
                    if (!$A.util.isUndefinedOrNull(params)) {
                        action.setParams(params);
                    }

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

            showQuickErrorToast(response) {
                const message = this.parseMessage(response);
                helper.notification().showQuickErrorToast(message);
            },

            showLongErrorToast(response) {
                const message = this.parseMessage(response);
                helper.notification().showLongErrorToast(message)
            },

            parseMessage: function(response) {
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
        };
    },

    /* Component creation utilities */
    component: function() {

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
        };
    }
})