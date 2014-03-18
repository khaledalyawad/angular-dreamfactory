'use strict';


angular.module('ngDreamFactory', [])
    .service('DreamFactory', ['DSP_URL', 'DSP_API_KEY', '$http', '$rootScope',
        function (DSP_URL, DSP_API_KEY, $http, $rootScope) {

            var swaggerInstance = null,
                ApiKeyAuthorization,
                PasswordAuthorization,
                SwaggerApi,
                SwaggerAuthorizations,
                SwaggerHttp,
                SwaggerModel,
                SwaggerModelProperty,
                SwaggerOperation,
                SwaggerRequest,
                SwaggerResource,
                __bind = function (fn, me) {
                    return function () {
                        return fn.apply(me, arguments);
                    };
                },
                log = function(){
                    log.history = log.history || [];
                    log.history.push(arguments);
                    if(this.console){
                        console.log(arguments);
                    }
                },
                sanitize = function(nickname) {
                    var op;
                    op = nickname.replace(/[\s!@#$%^&*()_+=\[{\]};:<>|./?,\\'""-]/g, '_');
                    //'
                    op = op.replace(/((_){2,})/g, '_');
                    op = op.replace(/^(_)*/g, '');
                    op = op.replace(/([_])*$/g, '');
                    return op;
                },
                ready = false;


            SwaggerApi = (function() {

                var SwaggerApi = function(url, options) {
                    var self = this;
                    this.sanitize = sanitize;
                    this.url = null;
                    this.debug = false;
                    this.basePath = null;
                    this.authorizations = null;
                    this.authorizationScheme = null;
                    this.info = {};
                    this.spec = null;

                    if(typeof url === 'string') {
                        this.url = url;
                    }
                    else if(typeof url === 'object') {
                        options = url;
                        this.url = options.url;
                    }
                    options = (options||{});

                    if (options.success != null)
                        this.success = options.success;

                    this.failure = options.failure != null ? options.failure : function() {};
                    this.progress = options.progress != null ? options.progress : function() {};


                    if (options.success != null) {

                        if(options.obj) {
                            // use the supplied object
                            this.specFromObject(options.obj, self.selfReflect);
                        }
                        else {
                            this.specFromURL(this.url, self.selfReflect);

                        }
                    }
                    return this;
                }

                // this will go away
                SwaggerApi.prototype.build = function() {
                    var self = this;
                    this.selfReflect(self);
                    return;
                };

                // passes a swagger spec object to the callback
                SwaggerApi.prototype.specFromObject = function(obj, callback, error) {
                    var self = this;
                    if(callback) {
                        var validated = this.validate(obj);
                        var processed = this.process(validated, this);
                        setTimeout(function() {
                            callback(processed)
                        }, 10);
                    }
                    return self;
                }

                // passes a swagger spec object to the callback
                SwaggerApi.prototype.specFromURL = function(url, callback) {
                    var self = this;
                    var apis = [];

                    var listing = function() {
                        var obj = {
                            /*useJQuery: self.useJQuery,*/
                            url: url,
                            method: "get",
                            headers: {
                                accept: "application/json"
                            },
                            on: {
                                error: function(response) {
                                    return self.fail(response.status + ' : ' + response.statusText + ' ' + self.url);
                                },
                                response: function(resp) {

                                    /*var resourceListing = self.validate(resp.obj || JSON.parse(resp.data));*/
                                    var resourceListing = self.validate(resp || angular.fromJson(resp.data));

                                    if (resourceListing.basePath) {
                                        self.basePath = resourceListing.basePath;
                                    } else if (self.url.indexOf('?') > 0) {
                                        self.basePath = self.url.substring(0, self.url.lastIndexOf('?'));
                                    } else {
                                        self.basePath = self.url;
                                    }
                                    if(resourceListing && resourceListing.apis) {
                                        resourceListing.apiDeclarations = [];
                                        var expectedCount = resourceListing.apis.length;
                                        var responses = 0;

                                        for(var i in resourceListing.apis) {
                                            var api = resourceListing.apis[i];
                                            var url = self.basePath + api.path;
                                            var description = api.description;
                                            obj = {
                                                url: url,
                                                method: "get",
                                                useJQuery: self.useJQuery,
                                                headers: {
                                                    accept: "application/json"
                                                },
                                                on: {
                                                    response: function(resp) {
                                                        /*var apiDeclaration = resp.obj || angular.fromJson(resp.data);*/
                                                        var apiDeclaration = resp || angular.fromJson(resp.data);
                                                        responses += 1;
                                                        if(apiDeclaration) {
                                                            apiDeclaration.description = description;
                                                            resourceListing.apiDeclarations.push(apiDeclaration);
                                                        }

                                                        // all done, process callback
                                                        if(responses === expectedCount) {
                                                            delete resourceListing.apis;
                                                            var validated = self.validate(resourceListing);
                                                            var processed = self.process(validated, self);
                                                            callback(processed, self);
                                                        }
                                                    },
                                                    error: function(response) {
                                                        return self.fail("Unable to read api '" +
                                                            self.name + "' from path " + self.url + " (server returned " + response.statusText + ")");
                                                    }
                                                }
                                            };
                                            /*
                                             var e = typeof window !== 'undefined' ? window : exports;
                                             e.authorizations.apply(obj);
                                             */

                                            _getSwagger().authorizations.apply(obj);
                                            new SwaggerHttp().execute(obj);
                                        }
                                    }
                                }
                            }
                        };


                        /*
                         var e = (typeof window !== 'undefined' ? window : exports);
                         e.authorizations.apply(obj);
                         */


                        _getSwagger().authorizations.apply(obj);
                        new SwaggerHttp().execute(obj);
                        return this;


                    }.call();

                };

                SwaggerApi.prototype.validate = function(spec) {
                    var output = null;
                    if(spec) {
                        if(spec.swaggerVersion === "1.0")
                            output = this.convert1_0(spec);
                        else if (spec.swaggerVersion === "1.1")
                            output = this.convert1_1(spec);
                        else
                            output = spec;
                    }
                    return output;
                };

                SwaggerApi.prototype.convert1_1 = function(spec) {
                    log("converting 1.1 spec");
                    return spec;
                }

                SwaggerApi.prototype.convert1_0 = function(spec) {
                    if(spec && spec.apiDeclarations)
                        log("converting 1.0 spec");
                    else
                        log("converting 1.0 resource listing");

                    for(var j in spec.apis) {
                        var api = spec.apis[j];

                        // update the .{format} syntax to .json
                        var path = api.path;
                        if(path.indexOf(".{format}") > 0){
                            api.path = path.replace('{format}', 'json');
                        }
                    }

                    for(var i in spec.apiDeclarations) {
                        var declaration = spec.apiDeclarations[i];

                        var models = declaration.models;

                        // convert models
                        for(var name in models) {
                            var model = models[name];

                            model.id = name;

                            delete model.uniqueItems;
                            delete model.type;

                            for(var k in model.properties) {
                                var property = model.properties[k];
                                var type = (property.type || property.dataType);

                                if(type) {
                                    if(type.indexOf("LIST[") === 0) {
                                        var converted = this.convertDataType(type, models);
                                        property.type = "array";
                                        if(typeof converted === 'object')
                                            property.items = converted;
                                        else {
                                            property.items = {};
                                            property.items.$ref = converted;
                                        }
                                    }
                                    else {
                                        var converted = this.convertDataType(type, models);
                                        property.type = converted ? converted.type : "null";
                                        if(typeof converted === 'object') {
                                            property.type = converted.type;
                                            if(converted.format)
                                                property.format = converted.format;
                                        }
                                        else
                                            property.type = converted;
                                    }
                                }
                                delete property.dataType;
                            }
                        }

                        for(var j in declaration.apis) {
                            var api = declaration.apis[j];

                            // update the .{format} syntax to .json
                            var path = api.path;
                            if(path.indexOf(".{format}") > 0){
                                api.path = path.replace('{format}', 'json');
                            }

                            // update response objects
                            for(var k in api.operations) {
                                var operation = api.operations[k];
                                var dataType = operation.responseClass;

                                // convert "ok" to "void"
                                if(dataType === "ok") {
                                    dataType = "void";
                                    operation.type = "void"
                                }
                                else if(dataType && dataType.indexOf("List[") === 0) {
                                    // convert List[...] to json schema array & items
                                    var inner = dataType.substring(dataType.indexOf('[') + 1, dataType.indexOf(']'));
                                    var converted = this.convertDataType(inner, models);
                                    operation.type = "array";
                                    if(typeof converted === 'object')
                                        operation.items = converted;
                                    else {
                                        operation.items = {};
                                        operation.items.$ref = converted;
                                    }
                                }
                                else {
                                    var converted = this.convertDataType(dataType, models);
                                    operation.type = converted ? converted.type : "null";
                                    if(typeof converted === 'object') {
                                        operation.type = converted.type;
                                        if(converted.format)
                                            operation.format = converted.format;
                                    }
                                    else
                                        operation.type = converted;
                                }
                                delete operation.responseClass;
                            }
                        }
                    }

                    return spec;
                };

                SwaggerApi.prototype.convertDataType = function (name, models) {
                    if(name) {
                        var lc = name.toLowerCase();
                        if(lc === "long") {
                            return {
                                type: "integer",
                                format: "int64"
                            };
                        }
                        else if(lc === "integer" || lc === "int") {
                            return {
                                type: "integer",
                                format: "int32"
                            }
                        }
                        else if(lc === "float") {
                            return {
                                type: "number",
                                format: "float"
                            }
                        }
                        else if(lc === "double") {
                            return {
                                type: "number",
                                format: "double"
                            }
                        }
                        else if(lc === "dateTime") {
                            return {
                                type: "string",
                                format: "date-time"
                            }
                        }
                        else if(lc === "date") {
                            return {
                                type: "string",
                                format: "date"
                            };
                        }
                        else {
                            // verify case matching
                            if(typeof models[name] !== 'undefined') {
                                return name;
                            }
                            else {
                                var snakeCaseName = name.substring(0,1).toUpperCase() + name.substring(1);
                                if(typeof models[snakeCaseName] !== 'undefined') {
                                    return snakeCaseName;
                                }
                                else {
                                    return name;
                                }
                            }
                        }
                    }
                };

                SwaggerApi.prototype.process = function(spec, parent) {
                    parent.apis = {};
                    parent.apisArray = [];
                    parent.produces = spec.produces;
                    parent.consumes = spec.consumes;
                    parent.authSchemes = spec.authorizations;
                    parent.apiVersion = spec.apiVersion;
                    parent.swaggerVersion = spec.swaggerVersion;

                    if(spec.info)
                        parent.info = spec.info;

                    parent.basePath = spec.basePath;

                    for(var i in spec.apiDeclarations) {
                        var api = spec.apiDeclarations[i];
                        var name = api.resourcePath.replace(/\//g, '');
                        var resource = new SwaggerResource(null, parent, api);

                        parent.apis[name] = resource;
                        parent.apisArray.push(resource);
                    }
                    // parent.selfReflect();
                    return parent;
                }

                SwaggerApi.prototype.buildFromSpec = function(response) {
                    if (response.apiVersion != null) {
                        this.apiVersion = response.apiVersion;
                    }
                    this.apis = {};
                    this.apisArray = [];
                    this.produces = response.produces;
                    this.authSchemes = response.authorizations;
                    if (response.info != null) {
                        this.info = response.info;
                    }
                    var isApi = false;
                    for (var i in response.apis) {
                        var api = response.apis[i];
                        if (api.operations) {
                            for (var j in api.operations) {
                                var operation = api.operations[j];
                                isApi = true;
                            }
                        }
                    }
                    if (response.basePath) {
                        this.basePath = response.basePath;
                    } else if (this.url.indexOf('?') > 0) {
                        this.basePath = this.url.substring(0, this.url.lastIndexOf('?'));
                    } else {
                        this.basePath = this.url;
                    }

                    var res = null;

                    if (isApi) {
                        var newName = response.resourcePath.replace(/\//g, '');
                        this.resourcePath = response.resourcePath;
                        res = new SwaggerResource(response, this);
                        this.apis[newName] = res;
                        this.apisArray.push(res);
                    } else {
                        for (var k in response.apis) {
                            var resource = response.apis[k];
                            res = new SwaggerResource(resource, this);
                            this.apis[res.name] = res;
                            this.apisArray.push(res);
                        }
                    }
                    if (this.success) {
                        this.success();
                    }
                    return this;
                };

                SwaggerApi.prototype.buildFrom1_1Spec = function(response) {
                    log("This API is using a deprecated version of Swagger!  Please see http://github.com/wordnik/swagger-core/wiki for more info");
                    if (response.apiVersion != null)
                        this.apiVersion = response.apiVersion;
                    this.apis = {};
                    this.apisArray = [];
                    this.produces = response.produces;
                    if (response.info != null) {
                        this.info = response.info;
                    }
                    var isApi = false;
                    for (var i = 0; i < response.apis.length; i++) {
                        var api = response.apis[i];
                        if (api.operations) {
                            for (var j = 0; j < api.operations.length; j++) {
                                var operation = api.operations[j];
                                isApi = true;
                            }
                        }
                    }
                    if (response.basePath) {
                        this.basePath = response.basePath;
                    } else if (this.url.indexOf('?') > 0) {
                        this.basePath = this.url.substring(0, this.url.lastIndexOf('?'));
                    } else {
                        this.basePath = this.url;
                    }
                    if (isApi) {
                        var newName = response.resourcePath.replace(/\//g, '');
                        this.resourcePath = response.resourcePath;
                        var res = new SwaggerResource(response, this);
                        this.apis[newName] = res;
                        this.apisArray.push(res);
                    } else {
                        for (var k in response.apis) {
                            var resource = response.apis[k];
                            res = new SwaggerResource(resource, this);
                            this.apis[res.name] = res;
                            this.apisArray.push(res);
                        }
                    }
                    if (this.success)
                        this.success();
                    return this;
                };

                SwaggerApi.prototype.selfReflect = function(obj) {
                    if (obj.apis == null)
                        return false;
                    for (var resource_name in obj.apis) {
                        var resource = obj.apis[resource_name];
                        if (resource.ready == null) {
                            return false;
                        }
                    }
                    obj.setConsolidatedModels();
                    obj.ready = true;
                    if (obj.success != null) {
                        return obj.success();
                    }
                };

                SwaggerApi.prototype.fail = function(message) {
                    this.failure(message);
                    throw message;
                };

                SwaggerApi.prototype.setConsolidatedModels = function() {
                    this.modelsArray = [];
                    this.models = {};
                    for (var resource_name in this.apis) {
                        var resource = this.apis[resource_name];
                        for (var modelName in resource.models) {
                            if (this.models[modelName] == null) {
                                this.models[modelName] = resource.models[modelName];
                                this.modelsArray.push(resource.models[modelName]);
                            }
                        }
                    }
                    var results = [];
                    for (var i in this.modelsArray) {
                        var model = this.modelsArray[i];
                        results.push(model.setReferencedModels(this.models));
                    }
                    return results;
                };

                SwaggerApi.prototype.help = function() {
                    var operation, operation_name, parameter, resource, resource_name, _i, _len, _ref, _ref1, _ref2;
                    _ref = this.apis;
                    for (resource_name in _ref) {
                        resource = _ref[resource_name];
                        log(resource_name);
                        _ref1 = resource.operations;
                        for (operation_name in _ref1) {
                            operation = _ref1[operation_name];
                            log("  " + operation.nickname);
                            _ref2 = operation.parameters;
                            for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
                                parameter = _ref2[_i];
                                log("    " + parameter.name + (parameter.required ? ' (required)' : '') + " - " + parameter.description);
                            }
                        }
                    }
                    return this;
                };

                return SwaggerApi;

            })();

            SwaggerResource = (function() {


                var SwaggerResource = function(resourceObj, api, obj) {
                    var self = this;
                    this.api = api;
                    this.produces = [];
                    this.consumes = [];
                    this.operations = {};
                    this.operationsArray = [];
                    this.modelsArray = [];
                    this.models = {};
                    this.rawModels = {};

                    if(obj) {
                        this.name = obj.resourcePath;
                        this.path = obj.resourcePath;
                        this.description = (obj.description||"");
                        return this.addApiDeclaration(obj);
                    }
                    else {
                        this.path = this.api.resourcePath != null ? this.api.resourcePath : resourceObj.path;
                        this.description = resourceObj.description;
                        var parts = this.path.split("/");
                        this.name = parts[parts.length - 1].replace('.{format}', '');
                        this.basePath = this.api.basePath;
                        this.useJQuery = (typeof api.useJQuery !== 'undefined' ? api.useJQuery : null);

                        if (resourceObj && (resourceObj.apis != null) && (this.api.resourcePath != null)) {
                            this.addApiDeclaration(resourceObj);
                        } else {
                            if (this.path == null) {
                                this.api.fail("SwaggerResources must have a path.");
                            }
                            if (this.path.substring(0, 4) === 'http') {
                                this.url = this.path.replace('{format}', 'json');
                            } else {
                                this.url = this.api.basePath + this.path.replace('{format}', 'json');
                            }
                            this.api.progress('fetching resource ' + this.name + ': ' + this.url);
                            obj = {
                                url: this.url,
                                method: "get",
                                useJQuery: this.useJQuery,
                                headers: {
                                    accept: "application/json"
                                },
                                on: {
                                    response: function(resp) {
                                        var responseObj = resp.obj || angular.fromJson(resp.data);
                                        return self.addApiDeclaration(responseObj);
                                    },
                                    error: function(response) {
                                        return self.fail("Unable to read api '" +
                                            self.name + "' from path " + self.url + " (server returned " + response.statusText + ")");
                                    }
                                }
                            };
                            var e = typeof window !== 'undefined' ? window : exports;
                            e.authorizations.apply(obj);
                            new SwaggerHttp().execute(obj);
                        }
                    }
                }

                SwaggerResource.prototype.getAbsoluteBasePath = function(relativeBasePath) {
                    var parts, pos, url;
                    url = this.api.basePath;
                    pos = url.lastIndexOf(relativeBasePath);
                    if (pos === -1) {
                        parts = url.split("/");
                        url = parts[0] + "//" + parts[2];
                        if (relativeBasePath.indexOf("/") === 0) {
                            return url + relativeBasePath;
                        } else {
                            return url + "/" + relativeBasePath;
                        }
                    } else if (relativeBasePath === "/") {
                        return url.substring(0, pos);
                    } else {
                        return url.substring(0, pos) + relativeBasePath;
                    }
                };

                SwaggerResource.prototype.addApiDeclaration = function(obj) {
                    if (obj.produces)
                        this.produces = obj.produces;
                    if (obj.consumes)
                        this.consumes = obj.consumes;
                    if ((obj.basePath != null) && obj.basePath.replace(/\s/g, '').length > 0)
                        this.basePath = obj.basePath.indexOf("http") === -1 ? this.getAbsoluteBasePath(obj.basePath) : obj.basePath;

                    this.addModels(obj.models);
                    if (obj.apis) {
                        for (var i in obj.apis) {
                            var endpoint = obj.apis[i];
                            this.addOperations(endpoint.path, endpoint.operations, obj.consumes, obj.produces);
                        }
                    }
                    this.api[sanitize(this.name)] = this;
                    this.ready = true;
                    return this; //.api.selfReflect();
                };

                SwaggerResource.prototype.addModels = function(models) {
                    if (models) {
                        for (var modelName in models) {
                            if (this.models[modelName] == null) {
                                var swaggerModel = new SwaggerModel(modelName, models[modelName]);
                                this.modelsArray.push(swaggerModel);
                                this.models[modelName] = swaggerModel;
                                this.rawModels[modelName] = models[modelName];
                            }
                        }
                        var output = [];
                        for (var i in this.modelsArray) {
                            var model = this.modelsArray[i];
                            output.push(model.setReferencedModels(this.models));
                        }
                        return output;
                    }
                };

                SwaggerResource.prototype.addOperations = function(resourcePath, operations, consumes, produces) {
                    if (operations) {
                        var output = [];
                        for (var i in operations) {
                            var o = operations[i];
                            consumes = this.consumes;
                            produces = this.produces;
                            if (o.consumes != null)
                                consumes = o.consumes;
                            else
                                consumes = this.consumes;

                            if (o.produces != null)
                                produces = o.produces;
                            else
                                produces = this.produces;
                            var type = (o.type||o.responseClass);

                            if (type === "array") {
                                var ref = null;
                                if (o.items)
                                    ref = o.items["type"] || o.items["$ref"];
                                type = "array[" + ref + "]";
                            }
                            var responseMessages = o.responseMessages;
                            var method = o.method;
                            if (o.httpMethod) {
                                method = o.httpMethod;
                            }
                            if (o.supportedContentTypes) {
                                consumes = o.supportedContentTypes;
                            }
                            if (o.errorResponses) {
                                responseMessages = o.errorResponses;
                                for (var j = 0; j < responseMessages.length; j++) {
                                    var r = responseMessages[j];
                                    r.message = r.reason;
                                    r.reason = null;
                                }
                            }
                            o.nickname = sanitize(o.nickname);

                            var op = new SwaggerOperation({
                                path: resourcePath,
                                nickname: o.nickname,
                                method: method,
                                parameters: o.parameters,
                                summary: o.summary,
                                notes: o.notes,
                                type: type,
                                responseMessages: responseMessages,
                                resource: this,
                                consumes: consumes,
                                produces: produces,
                                authorizations: o.authorizations
                            })
                            this.operations[op.nickname] = op;
                            output.push(this.operationsArray.push(op));
                        }
                        return output;
                    }
                };

                SwaggerResource.prototype.help = function() {
                    var op = this.operations;
                    var output = [];
                    for (var operation_name in op) {
                        var operation = op[operation_name];
                        var msg = "  " + operation.nickname;
                        for (var i = 0; i < operation.parameters; i++) {
                            var parameter = operation.parameters[i];
                            msg.concat("    " + parameter.name + (parameter.required ? ' (required)' : '') + " - " + parameter.description);
                        }
                        output.push(msg);
                    }
                    return output;
                };

                return SwaggerResource;

            })();

            SwaggerModel = (function() {
                var SwaggerModel = function(modelName, obj) {
                    this.name = obj.id != null ? obj.id : modelName;
                    this.properties = [];
                    for (var propertyName in obj.properties) {
                        if (obj.required != null) {
                            for (value in obj.required) {
                                if (propertyName === obj.required[value]) {
                                    obj.properties[propertyName].required = true;
                                }
                            }
                        }
                        var prop = new SwaggerModelProperty(propertyName, obj.properties[propertyName]);
                        this.properties.push(prop);
                    }
                }

                SwaggerModel.prototype.setReferencedModels = function(allModels) {
                    var results = [];
                    for (var i in this.properties) {
                        var property = this.properties[i];
                        var type = property.type || property.dataType;
                        if (allModels[type] != null)
                            results.push(property.refModel = allModels[type]);
                        else if ((property.refDataType != null) && (allModels[property.refDataType] != null))
                            results.push(property.refModel = allModels[property.refDataType]);
                        else
                            results.push(void 0);
                    }
                    return results;
                };

                SwaggerModel.prototype.getMockSignature = function(modelsToIgnore) {
                    var propertiesStr = [];
                    for (var i in this.properties) {
                        var prop = this.properties[i];
                        propertiesStr.push(prop.toString());
                    }

                    var strong = '<span class="strong">';
                    var stronger = '<span class="stronger">';
                    var strongClose = '</span>';
                    var classOpen = strong + this.name + ' {' + strongClose;
                    var classClose = strong + '}' + strongClose;
                    var returnVal = classOpen + '<div>' + propertiesStr.join(',</div><div>') + '</div>' + classClose;
                    if (!modelsToIgnore)
                        modelsToIgnore = [];
                    modelsToIgnore.push(this.name);

                    for (var i in this.properties) {
                        var prop = this.properties[i];
                        if ((prop.refModel != null) && modelsToIgnore.indexOf(prop.refModel.name) === -1) {
                            returnVal = returnVal + ('<br>' + prop.refModel.getMockSignature(modelsToIgnore));
                        }
                    }
                    return returnVal;
                };

                SwaggerModel.prototype.createJSONSample = function(modelsToIgnore) {
                    var result = {};
                    var modelsToIgnore = (modelsToIgnore||[])
                    modelsToIgnore.push(this.name);
                    for (var i in this.properties) {
                        var prop = this.properties[i];
                        result[prop.name] = prop.getSampleValue(modelsToIgnore);
                    }
                    modelsToIgnore.pop(this.name);
                    return result;
                };

                return SwaggerModel;
            })();

            SwaggerModelProperty = (function () {
                // TODO: remove conversion logic from here
                var SwaggerModelProperty = function(name, obj) {
                    this.name = name;
                    this.dataType = obj.type || obj.dataType || obj["$ref"];
                    this.isCollection = this.dataType && (this.dataType.toLowerCase() === 'array' || this.dataType.toLowerCase() === 'list' || this.dataType.toLowerCase() === 'set');
                    this.descr = obj.description;
                    this.required = obj.required;
                    if (obj.items != null) {
                        if (obj.items.type != null) {
                            this.refDataType = obj.items.type;
                        }
                        if (obj.items.$ref != null) {
                            this.refDataType = obj.items.$ref;
                        }
                    }
                    this.dataTypeWithRef = this.refDataType != null ? (this.dataType + '[' + this.refDataType + ']') : this.dataType;
                    if (obj.allowableValues != null) {
                        this.valueType = obj.allowableValues.valueType;
                        this.values = obj.allowableValues.values;
                        if (this.values != null) {
                            this.valuesString = "'" + this.values.join("' or '") + "'";
                        }
                    }
                    if (obj["enum"] != null) {
                        this.valueType = "string";
                        this.values = obj["enum"];
                        if (this.values != null) {
                            this.valueString = "'" + this.values.join("' or '") + "'";
                        }
                    }
                }

                SwaggerModelProperty.prototype.getSampleValue = function(modelsToIgnore) {
                    var result;
                    /*if ((this.refModel != null) && (modelsToIgnore.indexOf(prop.refModel.name) === -1)) {*/
                    if ((this.refModel != null) && (modelsToIgnore.indexOf(this.refModel.name) === -1)) {
                        result = this.refModel.createJSONSample(modelsToIgnore);
                    } else {
                        if (this.isCollection) {
                            result = this.toSampleValue(this.refDataType);
                        } else {
                            result = this.toSampleValue(this.dataType);
                        }
                    }
                    if (this.isCollection) {
                        return [result];
                    } else {
                        return result;
                    }
                };

                SwaggerModelProperty.prototype.toSampleValue = function(value) {
                    var result;
                    if (value === "integer") {
                        result = 0;
                    } else if (value === "boolean") {
                        result = false;
                    } else if (value === "double" || value === "number") {
                        result = 0.0;
                    } else if (value === "string") {
                        result = "";
                    } else {
                        result = value;
                    }
                    return result;
                };

                SwaggerModelProperty.prototype.toString = function() {
                    var req = this.required ? 'propReq' : 'propOpt';
                    var str = '<span class="propName ' + req + '">' + this.name + '</span> (<span class="propType">' + this.dataTypeWithRef + '</span>';
                    if (!this.required) {
                        str += ', <span class="propOptKey">optional</span>';
                    }
                    str += ')';
                    if (this.values != null) {
                        str += " = <span class='propVals'>['" + this.values.join("' or '") + "']</span>";
                    }
                    if (this.descr != null) {
                        str += ': <span class="propDesc">' + this.descr + '</span>';
                    }
                    return str;
                };

                return SwaggerModelProperty

            })();

            SwaggerOperation = (function () {
                var SwaggerOperation = function(opts) {
                    var self = this;

                    var errors = [];
                    this.nickname = (opts.nickname||errors.push("SwaggerOperations must have a nickname."));
                    this.path = (opts.path||errors.push("SwaggerOperation " + this.nickname + " is missing path."));
                    this.method = (opts.method||errors.push("SwaggerOperation " + this.nickname + " is missing method."));
                    this.parameters = (opts.parameters || []);
                    this.summary = opts.summary;
                    this.notes = opts.notes;
                    this.type = opts.type;
                    this.responseMessages = (opts.responseMessages||[]);
                    this.resource = (opts.resource||errors.push("Resource is required"));
                    this.consumes = opts.consumes;
                    this.produces = opts.produces;
                    this.authorizations = opts.authorizations;
                    this["do"] = __bind(this["do"], this);

                    if (errors.length > 0)
                        this.resource.api.fail(errors);

                    this.path = this.path.replace('{format}', 'json');
                    this.method = this.method.toLowerCase();
                    this.isGetMethod = this.method === "get";

                    this.resourceName = this.resource.name;
                    if(typeof this.type !== 'undefined' && this.type === 'void')
                        this.type = null;
                    else {
                        this.responseClassSignature = this.getSignature(this.type, this.resource.models);
                        this.responseSampleJSON = this.getSampleJSON(this.type, this.resource.models);
                    }

                    for(var i = 0; i < this.parameters.length; i ++) {
                        var param = this.parameters[i];
                        // might take this away
                        param.name = param.name || param.type || param.dataType;

                        // for 1.1 compatibility
                        var type = param.type || param.dataType;
                        if(type === 'array') {
                            type = 'array[' + (param.items.$ref ? param.items.$ref : param.items.type) + ']';
                        }

                        if(type.toLowerCase() === 'boolean') {
                            param.allowableValues = {};
                            param.allowableValues.values = ["true", "false"];
                        }
                        param.signature = this.getSignature(type, this.resource.models);
                        param.sampleJSON = this.getSampleJSON(type, this.resource.models);

                        var enumValue = param["enum"];
                        if(enumValue != null) {
                            param.isList = true;
                            param.allowableValues = {};
                            param.allowableValues.descriptiveValues = [];

                            for(var j = 0; j < enumValue.length; j++) {
                                var v = enumValue[j];
                                if(param.defaultValue != null) {
                                    param.allowableValues.descriptiveValues.push ({
                                        value: String(v),
                                        isDefault: (v === param.defaultValue)
                                    });
                                }
                                else {
                                    param.allowableValues.descriptiveValues.push ({
                                        value: String(v),
                                        isDefault: false
                                    });
                                }
                            }
                        }
                        else if(param.allowableValues != null) {
                            if(param.allowableValues.valueType === "RANGE")
                                param.isRange = true;
                            else
                                param.isList = true;
                            if(param.allowableValues != null) {
                                param.allowableValues.descriptiveValues = [];
                                if(param.allowableValues.values) {
                                    for(var j = 0; j < param.allowableValues.values.length; j++){
                                        var v = param.allowableValues.values[j];
                                        if(param.defaultValue != null) {
                                            param.allowableValues.descriptiveValues.push ({
                                                value: String(v),
                                                isDefault: (v === param.defaultValue)
                                            });
                                        }
                                        else {
                                            param.allowableValues.descriptiveValues.push ({
                                                value: String(v),
                                                isDefault: false
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    }
                    this.resource[this.nickname] = function(args, callback, error) {
                        return self["do"](args, callback, error);
                    };
                    this.resource[this.nickname].help = function() {
                        return self.help();
                    };
                }

                SwaggerOperation.prototype.isListType = function(type) {
                    if (type && type.indexOf('[') >= 0) {
                        return type.substring(type.indexOf('[') + 1, type.indexOf(']'));
                    } else {
                        return void 0;
                    }
                };

                SwaggerOperation.prototype.getSignature = function(type, models) {
                    var listType = this.isListType(type);
                    var isPrimitive = ((listType != null) && models[listType]) || (models[type] != null) ? false : true;
                    if (isPrimitive) {
                        return type;
                    } else {
                        if (listType != null) {
                            return models[listType].getMockSignature();
                        } else {
                            return models[type].getMockSignature();
                        }
                    }
                };

                SwaggerOperation.prototype.getSampleJSON = function(type, models) {
                    var isPrimitive, listType, val;
                    listType = this.isListType(type);
                    isPrimitive = ((listType != null) && models[listType]) || (models[type] != null) ? false : true;
                    val = isPrimitive ? void 0 : (listType != null ? models[listType].createJSONSample() : models[type].createJSONSample());
                    if (val) {
                        val = listType ? [val] : val;
                        return JSON.stringify(val, null, 2);
                    }
                };

                SwaggerOperation.prototype["do"] = function(args, opts, callback, error) {
                    var key, param, params, possibleParams, req, requestContentType, responseContentType, value, _i, _len, _ref;
                    if (args == null) {
                        args = {};
                    }
                    if (opts == null) {
                        opts = {};
                    }
                    requestContentType = null;
                    responseContentType = null;
                    if ((typeof args) === "function") {
                        error = opts;
                        callback = args;
                        args = {};
                    }
                    if ((typeof opts) === "function") {
                        error = callback;
                        callback = opts;
                    }
                    if (error == null) {
                        error = function(xhr, textStatus, error) {
                            return log(xhr, textStatus, error);
                        };
                    }
                    if (callback == null) {
                        callback = function(response) {
                            var content;
                            content = null;
                            if (response != null) {
                                content = response.data;
                            } else {
                                content = "no data";
                            }
                            return log("default callback: " + content);
                        };
                    }
                    params = {};
                    params.headers = [];
                    if (args.headers != null) {
                        params.headers = args.headers;
                        delete args.headers;
                    }

                    var possibleParams = [];
                    for(var i = 0; i < this.parameters.length; i++) {
                        var param = this.parameters[i];
                        if(param.paramType === 'header') {
                            if(args[param.name])
                                params.headers[param.name] = args[param.name];
                        }
                        else if(param.paramType === 'form' || param.paramType.toLowerCase() === 'file')
                            possibleParams.push(param);
                    }

                    if (args.body != null) {
                        params.body = args.body;
                        delete args.body;
                    }

                    if (possibleParams) {
                        for (key in possibleParams) {
                            value = possibleParams[key];
                            if (args[value.name]) {
                                params[value.name] = args[value.name];
                            }
                        }
                    }

                    req = new SwaggerRequest(this.method, this.urlify(args), params, opts, callback, error, this);
                    if (opts.mock != null) {
                        return req;
                    } else {
                        return true;
                    }
                };

                SwaggerOperation.prototype.pathJson = function() {
                    return this.path.replace("{format}", "json");
                };

                SwaggerOperation.prototype.pathXml = function() {
                    return this.path.replace("{format}", "xml");
                };

                SwaggerOperation.prototype.urlify = function(args) {
                    var url = this.resource.basePath + this.pathJson();
                    var params = this.parameters;
                    for(var i = 0; i < params.length; i ++){
                        var param = params[i];
                        if (param.paramType === 'path') {
                            if(args[param.name]) {
                                // apply path params and remove from args
                                var reg = new RegExp('\{' + param.name + '[^\}]*\}', 'gi');
                                url = url.replace(reg, encodeURIComponent(args[param.name]));
                                delete args[param.name];
                            }
                            else
                                throw "" + param.name + " is a required path param.";
                        }
                    }

                    var queryParams = "";
                    for(var i = 0; i < params.length; i ++){
                        var param = params[i];
                        if(param.paramType === 'query') {
                            if(queryParams !== '')
                                queryParams += "&";
                            if(args[param.name] !== undefined)
                                queryParams += encodeURIComponent(param.name) + '=' + encodeURIComponent(args[param.name]);
                        }
                    }
                    if ((queryParams != null) && queryParams.length > 0)
                        url += '?' + queryParams;
                    return url;
                };

                SwaggerOperation.prototype.supportHeaderParams = function() {
                    return this.resource.api.supportHeaderParams;
                };

                SwaggerOperation.prototype.supportedSubmitMethods = function() {
                    return this.resource.api.supportedSubmitMethods;
                };

                SwaggerOperation.prototype.getQueryParams = function(args) {
                    return this.getMatchingParams(['query'], args);
                };

                SwaggerOperation.prototype.getHeaderParams = function(args) {
                    return this.getMatchingParams(['header'], args);
                };

                SwaggerOperation.prototype.getMatchingParams = function(paramTypes, args) {
                    var matchingParams = {};
                    var params = this.parameters;
                    for (var i = 0; i < params.length; i++) {
                        var param = params[i];
                        if (args && args[param.name])
                            matchingParams[param.name] = args[param.name];
                    }
                    var headers = this.resource.api.headers;
                    for (var name in headers) {
                        var value = headers[name];
                        matchingParams[name] = value;
                    }
                    return matchingParams;
                };

                SwaggerOperation.prototype.help = function() {
                    var msg = "";
                    var params = this.parameters;
                    for (var i = 0; i < params.length; i++) {
                        var param = params[i];
                        if (msg !== "")
                            msg += "\n";
                        msg += "* " + param.name + (param.required ? ' (required)' : '') + " - " + param.description;
                    }
                    return msg;
                };

                return SwaggerOperation;
            })();

            SwaggerRequest = (function () {
                var SwaggerRequest = function(type, url, params, opts, successCallback, errorCallback, operation, execution) {
                    var self = this;
                    var errors = [];
                    this.useJQuery = (typeof operation.useJQuery !== 'undefined' ? operation.useJQuery : null);
                    this.type = (type||errors.push("SwaggerRequest type is required (get/post/put/delete/patch/options)."));
                    this.url = (url||errors.push("SwaggerRequest url is required."));
                    this.params = params;
                    this.opts = opts;
                    this.successCallback = (successCallback||errors.push("SwaggerRequest successCallback is required."));
                    this.errorCallback = (errorCallback||errors.push("SwaggerRequest error callback is required."));
                    this.operation = (operation||errors.push("SwaggerRequest operation is required."));
                    this.execution = execution;
                    this.headers = (params.headers||{});

                    if(errors.length > 0) {
                        throw errors;
                    }

                    this.type = this.type.toUpperCase();

                    var myHeaders = {};
                    var body = params.body;
                    var parent = params["parent"];
                    var requestContentType = "application/json";

                    var formParams = [];
                    var fileParams = [];
                    var params = this.operation.parameters;


                    for(var i = 0; i < params.length; i++) {
                        var param = params[i];
                        if(param.paramType === "form")
                            formParams.push(param);
                        else if(param.paramType === "file")
                            fileParams.push(param);
                    }


                    if (body && (this.type === "POST" || this.type === "PUT" || this.type === "PATCH")) {
                        if (this.opts.requestContentType) {
                            requestContentType = this.opts.requestContentType;
                        }
                    } else {
                        // if any form params, content type must be set
                        if(formParams.length > 0) {
                            if(fileParams.length > 0)
                                requestContentType = "multipart/form-data";
                            else
                                requestContentType = "application/x-www-form-urlencoded";
                        }
                        else if (this.type != "DELETE")
                            requestContentType = null;
                    }

                    if (requestContentType && this.operation.consumes) {
                        if (this.operation.consumes[requestContentType] === 'undefined') {
                            log("server doesn't consume " + requestContentType + ", try " + JSON.stringify(this.operation.consumes));
                            if (this.requestContentType === null) {
                                requestContentType = this.operation.consumes[0];
                            }
                        }
                    }

                    var responseContentType = null;
                    if (this.opts.responseContentType) {
                        responseContentType = this.opts.responseContentType;
                    } else {
                        responseContentType = "application/json";
                    }
                    if (responseContentType && this.operation.produces) {
                        if (this.operation.produces[responseContentType] === 'undefined') {
                            log("server can't produce " + responseContentType);
                        }
                    }
                    if (requestContentType && requestContentType.indexOf("application/x-www-form-urlencoded") === 0) {
                        var fields = {};
                        var possibleParams = {};
                        var values = {};

                        for(var i = 0; i < formParams.length; i++){
                            var param = formParams[i];
                            values[param.name] = param;
                        }

                        var encoded = "";
                        for(var key in values) {
                            value = this.params[key];
                            if(encoded !== "")
                                encoded += "&";
                            encoded += encodeURIComponent(key) + '=' + encodeURIComponent(value);
                        }
                        body = encoded
                    }
                    else {
                        if(typeof body === 'object' && requestContentType &&  requestContentType.indexOf("json") > 0)
                            body = JSON.stringify(body);
                    }
                    for (var name in this.headers)
                        myHeaders[name] = this.headers[name];
                    if (requestContentType && body)
                        myHeaders["Content-Type"] = requestContentType;
                    if (responseContentType)
                        myHeaders["Accept"] = responseContentType;

                    if (!((this.headers != null) && (this.headers.mock != null))) {
                        var obj = {
                            url: this.url,
                            method: this.type,
                            headers: myHeaders,
                            body: body,
                            useJQuery: this.useJQuery,
                            on: {
                                error: function(response) {
                                    return self.errorCallback(response, self.opts.parent);
                                },
                                redirect: function(response) {
                                    return self.successCallback(response, self.opts.parent);
                                },
                                307: function(response) {
                                    return self.successCallback(response, self.opts.parent);
                                },
                                response: function(response) {
                                    return self.successCallback(response, self.opts.parent);
                                }
                            }
                        };
                        var e;
                        if (typeof window !== 'undefined') {
                            e = window;
                        } else {
                            e = exports;
                        }
                        /*var status = e.authorizations.apply(obj, this.operation.authorizations);*/
                        var status = _getSwagger().authorizations.apply(obj, this.operation.authorizations);
                        if (opts.mock == null) {
                            if (status !== false) {
                                new SwaggerHttp().execute(obj);
                            } else {
                                obj.canceled = true;
                            }
                        } else {
                            return obj;
                        }
                    }
                };

                SwaggerRequest.prototype.asCurl = function() {
                    var results = [];
                    if(this.headers) {
                        for(var key in this.headers) {
                            results.push("--header \"" + key + ": " + this.headers[v] + "\"");
                        }
                    }
                    return "curl " + (results.join(" ")) + " " + this.url;
                };

                return SwaggerRequest;


            })();

            SwaggerHttp = (function () {

                /**
                 * SwaggerHttp is a wrapper for executing requests
                 */
                var SwaggerHttp = function() {};


                SwaggerHttp.prototype.isIE8 = function() {
                    var detectedIE = false;
                    if (typeof navigator !== 'undefined' && navigator.userAgent) {
                        nav = navigator.userAgent.toLowerCase();
                        if (nav.indexOf('msie') !== -1) {
                            var version = parseInt(nav.split('msie')[1]);
                            if (version <= 8) {
                                detectedIE = true;
                            }
                        }
                    }
                    return detectedIE;
                };

                /*
                 SwaggerHttp.prototype.execute = function(obj) {
                 if(obj && (typeof obj.useJQuery === 'boolean'))
                 this.useJQuery = obj.useJQuery;
                 else
                 this.useJQuery = this.isIE8();

                 if(this.useJQuery)
                 return new JQueryHttpClient().execute(obj);
                 else
                 return new ShredHttpClient().execute(obj);
                 }
                 */


                SwaggerHttp.prototype.execute = function (obj) {
                    //return this.shred.request(obj)

                    return $http({
                        method: obj.method,
                        url: obj.url,
                        headers: obj.headers,
                        data: obj.body
                    })
                        .success(function (data) {

                            return obj.on.response(data);
                        })
                        .error(function (error) {

                            return obj.on.error(error);
                        });

                };

                return SwaggerHttp;

            })();

            /**
             * SwaggerAuthorizations applys the correct authorization to an operation being executed
             */
            SwaggerAuthorizations = (function () {

                var SwaggerAuthorizations = function() {
                    this.authz = {};
                };

                SwaggerAuthorizations.prototype.add = function(name, auth) {
                    this.authz[name] = auth;
                    return auth;
                };

                SwaggerAuthorizations.prototype.remove = function(name) {
                    return delete this.authz[name];
                };

                SwaggerAuthorizations.prototype.apply = function(obj, authorizations) {
                    var status = null;
                    for (var key in this.authz) {
                        var value = this.authz[key];
                        var result = value.apply(obj, authorizations);
                        if (result === false)
                            status = false;
                        if (result === true)
                            status = true;
                    }
                    return status;
                };

                return SwaggerAuthorizations;

            })();

            /**
             * ApiKeyAuthorization allows a query param or header to be injected
             */
            ApiKeyAuthorization = (function () {

                var ApiKeyAuthorization = function(name, value, type) {
                    this.name = name;
                    this.value = value;
                    this.type = type;
                };

                ApiKeyAuthorization.prototype.apply = function(obj, authorizations) {
                    if (this.type === "query") {
                        if (obj.url.indexOf('?') > 0)
                            obj.url = obj.url + "&" + this.name + "=" + this.value;
                        else
                            obj.url = obj.url + "?" + this.name + "=" + this.value;
                        return true;
                    } else if (this.type === "header") {
                        obj.headers[this.name] = this.value;
                        return true;
                    }
                };

                return ApiKeyAuthorization;

            })();

            /**
             * Password Authorization is a basic auth implementation
             */
            PasswordAuthorization = (function () {

                var PasswordAuthorization = function(name, username, password) {
                    this.name = name;
                    this.username = username;
                    this.password = password;
                    this._btoa = null;
                    if (typeof window !== 'undefined')
                        this._btoa = btoa;
                    else
                        this._btoa = require("btoa");
                };

                PasswordAuthorization.prototype.apply = function(obj, authorizations) {
                    obj.headers["Authorization"] = "Basic " + this._btoa(this.username + ":" + this.password);
                    return true;
                };

                return PasswordAuthorization;
            })();


            function _setSwagger(swaggerObj) {

                swaggerInstance = swaggerObj;
            }

            function _getSwaggerInit() {
                return  {
                    ApiKeyAuthorization: ApiKeyAuthorization,
                    PasswordAuthorization: PasswordAuthorization,
                    SwaggerApi: SwaggerApi,
                    SwaggerAuthorizations: SwaggerAuthorizations,
                    SwaggerHttp: SwaggerHttp,
                    SwaggerModel: SwaggerModel,
                    SwaggerModelProperty: SwaggerModelProperty,
                    SwaggerOperation: SwaggerOperation,
                    SwaggerRequest: SwaggerRequest,
                    SwaggerResource: SwaggerResource
                }
            }

            function _getSwagger() {

                return swaggerInstance;
            }

            function _isReady() {
                return ready;
            }

            function _setReady(readyBool) {
                ready = readyBool;
            }


            return {

                dspUrl: DSP_URL,
                dspApiKey: DSP_API_KEY,
                supportedSubmitMethods: ['get', 'post', 'put', 'patch', 'merge', 'delete'],
                api: {},
                isReady: function () {
                    return _isReady();
                },
                swaggerInit: function () {

                    this.api = _getSwaggerInit();
                    this.api['authorizations'] = new this.api.SwaggerAuthorizations;
                    this.api.authorizations.add("X-DreamFactory-Application-Name", new this.api.ApiKeyAuthorization("X-DreamFactory-Application-Name", this.dspApiKey, "header"));
                    this.api.authorizations.add('Content-Type', new this.api.ApiKeyAuthorization('Content-Type', 'application/json', 'header'));
                    _setSwagger(this.api);


                    this.api = new this.api.SwaggerApi({
                        url: this.dspUrl + '/rest/api_docs',
                        supportedSubmitMethods: this.supportedSubmitMethods,
                        success: function () {
                            _setReady(true);
                            $rootScope.$broadcast('api:ready');
                        },
                        error: function () {
                            // Handle Errors
                            // comment
                        }
                    });

                    console.log(this.api)
                }
            }
        }])
    .run(['DreamFactory', function (DreamFactory) {
        DreamFactory.swaggerInit();
    }]);


