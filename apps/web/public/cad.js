var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// apps/web/src/widgets.ts
function dashboardWidgets(grid, widgets, preferences, save, notice) {
  grid.replaceChildren();
  grid.classList.add("dashboard-grid");
  let dragging = null;
  const makeButton = (label, action) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "small";
    button.textContent = label;
    button.onclick = action;
    return button;
  };
  const order = () => Array.from(grid.children).map((child) => child.dataset.widget).filter(Boolean);
  for (const key of preferences.dashboardWidgets) {
    if (!widgets[key]) continue;
    const wrapper = document.createElement("section");
    wrapper.className = "dashboard-widget";
    wrapper.dataset.widget = key;
    const size = preferences.widgetSizes?.[key];
    wrapper.style.gridColumn = `span ${size?.columns ?? 1}`;
    if (size) wrapper.style.height = size.height + "px";
    const controls2 = document.createElement("div");
    controls2.className = "toolbar widget-controls";
    const handle = makeButton("Move " + key, () => notice("Drag this handle or use Move earlier / later."));
    handle.draggable = true;
    handle.addEventListener("dragstart", (event) => {
      dragging = key;
      event.dataTransfer?.setData("text/plain", key);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
    });
    handle.addEventListener("dragend", () => {
      dragging = null;
    });
    wrapper.addEventListener("dragover", (event) => {
      if (dragging) event.preventDefault();
    });
    wrapper.addEventListener("drop", (event) => {
      event.preventDefault();
      if (!dragging || dragging === key) return;
      const source = Array.from(grid.children).find((c) => c.dataset.widget === dragging);
      if (source) grid.insertBefore(source, wrapper);
      dragging = null;
    });
    const width = document.createElement("select");
    width.setAttribute("aria-label", key + " widget width");
    width.add(new Option("One column", "1"));
    width.add(new Option("Two columns", "2"));
    width.value = String(size?.columns ?? 1);
    width.onchange = () => {
      wrapper.style.gridColumn = "span " + width.value;
    };
    controls2.append(handle, makeButton("Move earlier", () => {
      const previous = wrapper.previousElementSibling;
      if (previous) grid.insertBefore(wrapper, previous);
    }), makeButton("Move later", () => {
      const next = wrapper.nextElementSibling;
      if (next) grid.insertBefore(next, wrapper);
    }), width);
    wrapper.append(controls2, widgets[key]);
    grid.append(wrapper);
  }
  const controls = document.createElement("div");
  controls.className = "toolbar";
  const saveButton = makeButton("Save dashboard layout", () => {
    saveButton.disabled = true;
    const widgetSizes = {};
    for (const child of Array.from(grid.children)) {
      const key = child.dataset.widget;
      if (!key) continue;
      widgetSizes[key] = { columns: child.style.gridColumn.includes("2") ? 2 : 1, height: Math.max(160, Math.min(1200, Math.round(parseFloat(child.style.height) || child.getBoundingClientRect().height || 360))) };
    }
    void save({ ...preferences, dashboardWidgets: order(), widgetSizes }).then((saved) => {
      Object.assign(preferences, saved);
      notice("Dashboard layout saved to your account.");
    }).catch((e) => notice(e.message ?? "Layout could not be saved. Refresh before retrying.")).finally(() => {
      saveButton.disabled = false;
    });
  });
  controls.append(saveButton);
  grid.before(controls);
  return controls;
}

// node_modules/zod/v3/external.js
var external_exports = {};
__export(external_exports, {
  BRAND: () => BRAND,
  DIRTY: () => DIRTY,
  EMPTY_PATH: () => EMPTY_PATH,
  INVALID: () => INVALID,
  NEVER: () => NEVER,
  OK: () => OK,
  ParseStatus: () => ParseStatus,
  Schema: () => ZodType,
  ZodAny: () => ZodAny,
  ZodArray: () => ZodArray,
  ZodBigInt: () => ZodBigInt,
  ZodBoolean: () => ZodBoolean,
  ZodBranded: () => ZodBranded,
  ZodCatch: () => ZodCatch,
  ZodDate: () => ZodDate,
  ZodDefault: () => ZodDefault,
  ZodDiscriminatedUnion: () => ZodDiscriminatedUnion,
  ZodEffects: () => ZodEffects,
  ZodEnum: () => ZodEnum,
  ZodError: () => ZodError,
  ZodFirstPartyTypeKind: () => ZodFirstPartyTypeKind,
  ZodFunction: () => ZodFunction,
  ZodIntersection: () => ZodIntersection,
  ZodIssueCode: () => ZodIssueCode,
  ZodLazy: () => ZodLazy,
  ZodLiteral: () => ZodLiteral,
  ZodMap: () => ZodMap,
  ZodNaN: () => ZodNaN,
  ZodNativeEnum: () => ZodNativeEnum,
  ZodNever: () => ZodNever,
  ZodNull: () => ZodNull,
  ZodNullable: () => ZodNullable,
  ZodNumber: () => ZodNumber,
  ZodObject: () => ZodObject,
  ZodOptional: () => ZodOptional,
  ZodParsedType: () => ZodParsedType,
  ZodPipeline: () => ZodPipeline,
  ZodPromise: () => ZodPromise,
  ZodReadonly: () => ZodReadonly,
  ZodRecord: () => ZodRecord,
  ZodSchema: () => ZodType,
  ZodSet: () => ZodSet,
  ZodString: () => ZodString,
  ZodSymbol: () => ZodSymbol,
  ZodTransformer: () => ZodEffects,
  ZodTuple: () => ZodTuple,
  ZodType: () => ZodType,
  ZodUndefined: () => ZodUndefined,
  ZodUnion: () => ZodUnion,
  ZodUnknown: () => ZodUnknown,
  ZodVoid: () => ZodVoid,
  addIssueToContext: () => addIssueToContext,
  any: () => anyType,
  array: () => arrayType,
  bigint: () => bigIntType,
  boolean: () => booleanType,
  coerce: () => coerce,
  custom: () => custom,
  date: () => dateType,
  datetimeRegex: () => datetimeRegex,
  defaultErrorMap: () => en_default,
  discriminatedUnion: () => discriminatedUnionType,
  effect: () => effectsType,
  enum: () => enumType,
  function: () => functionType,
  getErrorMap: () => getErrorMap,
  getParsedType: () => getParsedType,
  instanceof: () => instanceOfType,
  intersection: () => intersectionType,
  isAborted: () => isAborted,
  isAsync: () => isAsync,
  isDirty: () => isDirty,
  isValid: () => isValid,
  late: () => late,
  lazy: () => lazyType,
  literal: () => literalType,
  makeIssue: () => makeIssue,
  map: () => mapType,
  nan: () => nanType,
  nativeEnum: () => nativeEnumType,
  never: () => neverType,
  null: () => nullType,
  nullable: () => nullableType,
  number: () => numberType,
  object: () => objectType,
  objectUtil: () => objectUtil,
  oboolean: () => oboolean,
  onumber: () => onumber,
  optional: () => optionalType,
  ostring: () => ostring,
  pipeline: () => pipelineType,
  preprocess: () => preprocessType,
  promise: () => promiseType,
  quotelessJson: () => quotelessJson,
  record: () => recordType,
  set: () => setType,
  setErrorMap: () => setErrorMap,
  strictObject: () => strictObjectType,
  string: () => stringType,
  symbol: () => symbolType,
  transformer: () => effectsType,
  tuple: () => tupleType,
  undefined: () => undefinedType,
  union: () => unionType,
  unknown: () => unknownType,
  util: () => util,
  void: () => voidType
});

// node_modules/zod/v3/helpers/util.js
var util;
(function(util2) {
  util2.assertEqual = (_) => {
  };
  function assertIs(_arg) {
  }
  util2.assertIs = assertIs;
  function assertNever(_x) {
    throw new Error();
  }
  util2.assertNever = assertNever;
  util2.arrayToEnum = (items) => {
    const obj = {};
    for (const item of items) {
      obj[item] = item;
    }
    return obj;
  };
  util2.getValidEnumValues = (obj) => {
    const validKeys = util2.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
    const filtered = {};
    for (const k of validKeys) {
      filtered[k] = obj[k];
    }
    return util2.objectValues(filtered);
  };
  util2.objectValues = (obj) => {
    return util2.objectKeys(obj).map(function(e) {
      return obj[e];
    });
  };
  util2.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
    const keys = [];
    for (const key in object) {
      if (Object.prototype.hasOwnProperty.call(object, key)) {
        keys.push(key);
      }
    }
    return keys;
  };
  util2.find = (arr, checker) => {
    for (const item of arr) {
      if (checker(item))
        return item;
    }
    return void 0;
  };
  util2.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && Number.isFinite(val) && Math.floor(val) === val;
  function joinValues(array, separator = " | ") {
    return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
  }
  util2.joinValues = joinValues;
  util2.jsonStringifyReplacer = (_, value) => {
    if (typeof value === "bigint") {
      return value.toString();
    }
    return value;
  };
})(util || (util = {}));
var objectUtil;
(function(objectUtil2) {
  objectUtil2.mergeShapes = (first, second) => {
    return {
      ...first,
      ...second
      // second overwrites first
    };
  };
})(objectUtil || (objectUtil = {}));
var ZodParsedType = util.arrayToEnum([
  "string",
  "nan",
  "number",
  "integer",
  "float",
  "boolean",
  "date",
  "bigint",
  "symbol",
  "function",
  "undefined",
  "null",
  "array",
  "object",
  "unknown",
  "promise",
  "void",
  "never",
  "map",
  "set"
]);
var getParsedType = (data) => {
  const t = typeof data;
  switch (t) {
    case "undefined":
      return ZodParsedType.undefined;
    case "string":
      return ZodParsedType.string;
    case "number":
      return Number.isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
    case "boolean":
      return ZodParsedType.boolean;
    case "function":
      return ZodParsedType.function;
    case "bigint":
      return ZodParsedType.bigint;
    case "symbol":
      return ZodParsedType.symbol;
    case "object":
      if (Array.isArray(data)) {
        return ZodParsedType.array;
      }
      if (data === null) {
        return ZodParsedType.null;
      }
      if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
        return ZodParsedType.promise;
      }
      if (typeof Map !== "undefined" && data instanceof Map) {
        return ZodParsedType.map;
      }
      if (typeof Set !== "undefined" && data instanceof Set) {
        return ZodParsedType.set;
      }
      if (typeof Date !== "undefined" && data instanceof Date) {
        return ZodParsedType.date;
      }
      return ZodParsedType.object;
    default:
      return ZodParsedType.unknown;
  }
};

// node_modules/zod/v3/ZodError.js
var ZodIssueCode = util.arrayToEnum([
  "invalid_type",
  "invalid_literal",
  "custom",
  "invalid_union",
  "invalid_union_discriminator",
  "invalid_enum_value",
  "unrecognized_keys",
  "invalid_arguments",
  "invalid_return_type",
  "invalid_date",
  "invalid_string",
  "too_small",
  "too_big",
  "invalid_intersection_types",
  "not_multiple_of",
  "not_finite"
]);
var quotelessJson = (obj) => {
  const json = JSON.stringify(obj, null, 2);
  return json.replace(/"([^"]+)":/g, "$1:");
};
var ZodError = class _ZodError extends Error {
  get errors() {
    return this.issues;
  }
  constructor(issues) {
    super();
    this.issues = [];
    this.addIssue = (sub) => {
      this.issues = [...this.issues, sub];
    };
    this.addIssues = (subs = []) => {
      this.issues = [...this.issues, ...subs];
    };
    const actualProto = new.target.prototype;
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    } else {
      this.__proto__ = actualProto;
    }
    this.name = "ZodError";
    this.issues = issues;
  }
  format(_mapper) {
    const mapper = _mapper || function(issue) {
      return issue.message;
    };
    const fieldErrors = { _errors: [] };
    const processError = (error) => {
      for (const issue of error.issues) {
        if (issue.code === "invalid_union") {
          issue.unionErrors.map(processError);
        } else if (issue.code === "invalid_return_type") {
          processError(issue.returnTypeError);
        } else if (issue.code === "invalid_arguments") {
          processError(issue.argumentsError);
        } else if (issue.path.length === 0) {
          fieldErrors._errors.push(mapper(issue));
        } else {
          let curr = fieldErrors;
          let i = 0;
          while (i < issue.path.length) {
            const el2 = issue.path[i];
            const terminal = i === issue.path.length - 1;
            if (!terminal) {
              curr[el2] = curr[el2] || { _errors: [] };
            } else {
              curr[el2] = curr[el2] || { _errors: [] };
              curr[el2]._errors.push(mapper(issue));
            }
            curr = curr[el2];
            i++;
          }
        }
      }
    };
    processError(this);
    return fieldErrors;
  }
  static assert(value) {
    if (!(value instanceof _ZodError)) {
      throw new Error(`Not a ZodError: ${value}`);
    }
  }
  toString() {
    return this.message;
  }
  get message() {
    return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
  }
  get isEmpty() {
    return this.issues.length === 0;
  }
  flatten(mapper = (issue) => issue.message) {
    const fieldErrors = {};
    const formErrors = [];
    for (const sub of this.issues) {
      if (sub.path.length > 0) {
        const firstEl = sub.path[0];
        fieldErrors[firstEl] = fieldErrors[firstEl] || [];
        fieldErrors[firstEl].push(mapper(sub));
      } else {
        formErrors.push(mapper(sub));
      }
    }
    return { formErrors, fieldErrors };
  }
  get formErrors() {
    return this.flatten();
  }
};
ZodError.create = (issues) => {
  const error = new ZodError(issues);
  return error;
};

// node_modules/zod/v3/locales/en.js
var errorMap = (issue, _ctx) => {
  let message;
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === ZodParsedType.undefined) {
        message = "Required";
      } else {
        message = `Expected ${issue.expected}, received ${issue.received}`;
      }
      break;
    case ZodIssueCode.invalid_literal:
      message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
      break;
    case ZodIssueCode.unrecognized_keys:
      message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
      break;
    case ZodIssueCode.invalid_union:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_union_discriminator:
      message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
      break;
    case ZodIssueCode.invalid_enum_value:
      message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
      break;
    case ZodIssueCode.invalid_arguments:
      message = `Invalid function arguments`;
      break;
    case ZodIssueCode.invalid_return_type:
      message = `Invalid function return type`;
      break;
    case ZodIssueCode.invalid_date:
      message = `Invalid date`;
      break;
    case ZodIssueCode.invalid_string:
      if (typeof issue.validation === "object") {
        if ("includes" in issue.validation) {
          message = `Invalid input: must include "${issue.validation.includes}"`;
          if (typeof issue.validation.position === "number") {
            message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
          }
        } else if ("startsWith" in issue.validation) {
          message = `Invalid input: must start with "${issue.validation.startsWith}"`;
        } else if ("endsWith" in issue.validation) {
          message = `Invalid input: must end with "${issue.validation.endsWith}"`;
        } else {
          util.assertNever(issue.validation);
        }
      } else if (issue.validation !== "regex") {
        message = `Invalid ${issue.validation}`;
      } else {
        message = "Invalid";
      }
      break;
    case ZodIssueCode.too_small:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "bigint")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.too_big:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "bigint")
        message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.custom:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_intersection_types:
      message = `Intersection results could not be merged`;
      break;
    case ZodIssueCode.not_multiple_of:
      message = `Number must be a multiple of ${issue.multipleOf}`;
      break;
    case ZodIssueCode.not_finite:
      message = "Number must be finite";
      break;
    default:
      message = _ctx.defaultError;
      util.assertNever(issue);
  }
  return { message };
};
var en_default = errorMap;

// node_modules/zod/v3/errors.js
var overrideErrorMap = en_default;
function setErrorMap(map) {
  overrideErrorMap = map;
}
function getErrorMap() {
  return overrideErrorMap;
}

// node_modules/zod/v3/helpers/parseUtil.js
var makeIssue = (params) => {
  const { data, path, errorMaps, issueData } = params;
  const fullPath = [...path, ...issueData.path || []];
  const fullIssue = {
    ...issueData,
    path: fullPath
  };
  if (issueData.message !== void 0) {
    return {
      ...issueData,
      path: fullPath,
      message: issueData.message
    };
  }
  let errorMessage = "";
  const maps = errorMaps.filter((m) => !!m).slice().reverse();
  for (const map of maps) {
    errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
  }
  return {
    ...issueData,
    path: fullPath,
    message: errorMessage
  };
};
var EMPTY_PATH = [];
function addIssueToContext(ctx, issueData) {
  const overrideMap = getErrorMap();
  const issue = makeIssue({
    issueData,
    data: ctx.data,
    path: ctx.path,
    errorMaps: [
      ctx.common.contextualErrorMap,
      // contextual error map is first priority
      ctx.schemaErrorMap,
      // then schema-bound map if available
      overrideMap,
      // then global override map
      overrideMap === en_default ? void 0 : en_default
      // then global default map
    ].filter((x) => !!x)
  });
  ctx.common.issues.push(issue);
}
var ParseStatus = class _ParseStatus {
  constructor() {
    this.value = "valid";
  }
  dirty() {
    if (this.value === "valid")
      this.value = "dirty";
  }
  abort() {
    if (this.value !== "aborted")
      this.value = "aborted";
  }
  static mergeArray(status, results) {
    const arrayValue = [];
    for (const s of results) {
      if (s.status === "aborted")
        return INVALID;
      if (s.status === "dirty")
        status.dirty();
      arrayValue.push(s.value);
    }
    return { status: status.value, value: arrayValue };
  }
  static async mergeObjectAsync(status, pairs) {
    const syncPairs = [];
    for (const pair of pairs) {
      const key = await pair.key;
      const value = await pair.value;
      syncPairs.push({
        key,
        value
      });
    }
    return _ParseStatus.mergeObjectSync(status, syncPairs);
  }
  static mergeObjectSync(status, pairs) {
    const finalObject = {};
    for (const pair of pairs) {
      const { key, value } = pair;
      if (key.status === "aborted")
        return INVALID;
      if (value.status === "aborted")
        return INVALID;
      if (key.status === "dirty")
        status.dirty();
      if (value.status === "dirty")
        status.dirty();
      if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
        finalObject[key.value] = value.value;
      }
    }
    return { status: status.value, value: finalObject };
  }
};
var INVALID = Object.freeze({
  status: "aborted"
});
var DIRTY = (value) => ({ status: "dirty", value });
var OK = (value) => ({ status: "valid", value });
var isAborted = (x) => x.status === "aborted";
var isDirty = (x) => x.status === "dirty";
var isValid = (x) => x.status === "valid";
var isAsync = (x) => typeof Promise !== "undefined" && x instanceof Promise;

// node_modules/zod/v3/helpers/errorUtil.js
var errorUtil;
(function(errorUtil2) {
  errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
  errorUtil2.toString = (message) => typeof message === "string" ? message : message?.message;
})(errorUtil || (errorUtil = {}));

// node_modules/zod/v3/types.js
var ParseInputLazyPath = class {
  constructor(parent, value, path, key) {
    this._cachedPath = [];
    this.parent = parent;
    this.data = value;
    this._path = path;
    this._key = key;
  }
  get path() {
    if (!this._cachedPath.length) {
      if (Array.isArray(this._key)) {
        this._cachedPath.push(...this._path, ...this._key);
      } else {
        this._cachedPath.push(...this._path, this._key);
      }
    }
    return this._cachedPath;
  }
};
var handleResult = (ctx, result) => {
  if (isValid(result)) {
    return { success: true, data: result.value };
  } else {
    if (!ctx.common.issues.length) {
      throw new Error("Validation failed but no issues detected.");
    }
    return {
      success: false,
      get error() {
        if (this._error)
          return this._error;
        const error = new ZodError(ctx.common.issues);
        this._error = error;
        return this._error;
      }
    };
  }
};
function processCreateParams(params) {
  if (!params)
    return {};
  const { errorMap: errorMap2, invalid_type_error, required_error, description } = params;
  if (errorMap2 && (invalid_type_error || required_error)) {
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  }
  if (errorMap2)
    return { errorMap: errorMap2, description };
  const customMap = (iss, ctx) => {
    const { message } = params;
    if (iss.code === "invalid_enum_value") {
      return { message: message ?? ctx.defaultError };
    }
    if (typeof ctx.data === "undefined") {
      return { message: message ?? required_error ?? ctx.defaultError };
    }
    if (iss.code !== "invalid_type")
      return { message: ctx.defaultError };
    return { message: message ?? invalid_type_error ?? ctx.defaultError };
  };
  return { errorMap: customMap, description };
}
var ZodType = class {
  get description() {
    return this._def.description;
  }
  _getType(input) {
    return getParsedType(input.data);
  }
  _getOrReturnCtx(input, ctx) {
    return ctx || {
      common: input.parent.common,
      data: input.data,
      parsedType: getParsedType(input.data),
      schemaErrorMap: this._def.errorMap,
      path: input.path,
      parent: input.parent
    };
  }
  _processInputParams(input) {
    return {
      status: new ParseStatus(),
      ctx: {
        common: input.parent.common,
        data: input.data,
        parsedType: getParsedType(input.data),
        schemaErrorMap: this._def.errorMap,
        path: input.path,
        parent: input.parent
      }
    };
  }
  _parseSync(input) {
    const result = this._parse(input);
    if (isAsync(result)) {
      throw new Error("Synchronous parse encountered promise.");
    }
    return result;
  }
  _parseAsync(input) {
    const result = this._parse(input);
    return Promise.resolve(result);
  }
  parse(data, params) {
    const result = this.safeParse(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  safeParse(data, params) {
    const ctx = {
      common: {
        issues: [],
        async: params?.async ?? false,
        contextualErrorMap: params?.errorMap
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const result = this._parseSync({ data, path: ctx.path, parent: ctx });
    return handleResult(ctx, result);
  }
  "~validate"(data) {
    const ctx = {
      common: {
        issues: [],
        async: !!this["~standard"].async
      },
      path: [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    if (!this["~standard"].async) {
      try {
        const result = this._parseSync({ data, path: [], parent: ctx });
        return isValid(result) ? {
          value: result.value
        } : {
          issues: ctx.common.issues
        };
      } catch (err) {
        if (err?.message?.toLowerCase()?.includes("encountered")) {
          this["~standard"].async = true;
        }
        ctx.common = {
          issues: [],
          async: true
        };
      }
    }
    return this._parseAsync({ data, path: [], parent: ctx }).then((result) => isValid(result) ? {
      value: result.value
    } : {
      issues: ctx.common.issues
    });
  }
  async parseAsync(data, params) {
    const result = await this.safeParseAsync(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  async safeParseAsync(data, params) {
    const ctx = {
      common: {
        issues: [],
        contextualErrorMap: params?.errorMap,
        async: true
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
    const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
    return handleResult(ctx, result);
  }
  refine(check, message) {
    const getIssueProperties = (val) => {
      if (typeof message === "string" || typeof message === "undefined") {
        return { message };
      } else if (typeof message === "function") {
        return message(val);
      } else {
        return message;
      }
    };
    return this._refinement((val, ctx) => {
      const result = check(val);
      const setError = () => ctx.addIssue({
        code: ZodIssueCode.custom,
        ...getIssueProperties(val)
      });
      if (typeof Promise !== "undefined" && result instanceof Promise) {
        return result.then((data) => {
          if (!data) {
            setError();
            return false;
          } else {
            return true;
          }
        });
      }
      if (!result) {
        setError();
        return false;
      } else {
        return true;
      }
    });
  }
  refinement(check, refinementData) {
    return this._refinement((val, ctx) => {
      if (!check(val)) {
        ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
        return false;
      } else {
        return true;
      }
    });
  }
  _refinement(refinement) {
    return new ZodEffects({
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "refinement", refinement }
    });
  }
  superRefine(refinement) {
    return this._refinement(refinement);
  }
  constructor(def) {
    this.spa = this.safeParseAsync;
    this._def = def;
    this.parse = this.parse.bind(this);
    this.safeParse = this.safeParse.bind(this);
    this.parseAsync = this.parseAsync.bind(this);
    this.safeParseAsync = this.safeParseAsync.bind(this);
    this.spa = this.spa.bind(this);
    this.refine = this.refine.bind(this);
    this.refinement = this.refinement.bind(this);
    this.superRefine = this.superRefine.bind(this);
    this.optional = this.optional.bind(this);
    this.nullable = this.nullable.bind(this);
    this.nullish = this.nullish.bind(this);
    this.array = this.array.bind(this);
    this.promise = this.promise.bind(this);
    this.or = this.or.bind(this);
    this.and = this.and.bind(this);
    this.transform = this.transform.bind(this);
    this.brand = this.brand.bind(this);
    this.default = this.default.bind(this);
    this.catch = this.catch.bind(this);
    this.describe = this.describe.bind(this);
    this.pipe = this.pipe.bind(this);
    this.readonly = this.readonly.bind(this);
    this.isNullable = this.isNullable.bind(this);
    this.isOptional = this.isOptional.bind(this);
    this["~standard"] = {
      version: 1,
      vendor: "zod",
      validate: (data) => this["~validate"](data)
    };
  }
  optional() {
    return ZodOptional.create(this, this._def);
  }
  nullable() {
    return ZodNullable.create(this, this._def);
  }
  nullish() {
    return this.nullable().optional();
  }
  array() {
    return ZodArray.create(this);
  }
  promise() {
    return ZodPromise.create(this, this._def);
  }
  or(option) {
    return ZodUnion.create([this, option], this._def);
  }
  and(incoming) {
    return ZodIntersection.create(this, incoming, this._def);
  }
  transform(transform) {
    return new ZodEffects({
      ...processCreateParams(this._def),
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "transform", transform }
    });
  }
  default(def) {
    const defaultValueFunc = typeof def === "function" ? def : () => def;
    return new ZodDefault({
      ...processCreateParams(this._def),
      innerType: this,
      defaultValue: defaultValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodDefault
    });
  }
  brand() {
    return new ZodBranded({
      typeName: ZodFirstPartyTypeKind.ZodBranded,
      type: this,
      ...processCreateParams(this._def)
    });
  }
  catch(def) {
    const catchValueFunc = typeof def === "function" ? def : () => def;
    return new ZodCatch({
      ...processCreateParams(this._def),
      innerType: this,
      catchValue: catchValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodCatch
    });
  }
  describe(description) {
    const This = this.constructor;
    return new This({
      ...this._def,
      description
    });
  }
  pipe(target) {
    return ZodPipeline.create(this, target);
  }
  readonly() {
    return ZodReadonly.create(this);
  }
  isOptional() {
    return this.safeParse(void 0).success;
  }
  isNullable() {
    return this.safeParse(null).success;
  }
};
var cuidRegex = /^c[^\s-]{8,}$/i;
var cuid2Regex = /^[0-9a-z]+$/;
var ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
var uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
var nanoidRegex = /^[a-z0-9_-]{21}$/i;
var jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
var durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
var emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
var _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
var emojiRegex;
var ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
var ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
var ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
var ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
var base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
var base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
var dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
var dateRegex = new RegExp(`^${dateRegexSource}$`);
function timeRegexSource(args) {
  let secondsRegexSource = `[0-5]\\d`;
  if (args.precision) {
    secondsRegexSource = `${secondsRegexSource}\\.\\d{${args.precision}}`;
  } else if (args.precision == null) {
    secondsRegexSource = `${secondsRegexSource}(\\.\\d+)?`;
  }
  const secondsQuantifier = args.precision ? "+" : "?";
  return `([01]\\d|2[0-3]):[0-5]\\d(:${secondsRegexSource})${secondsQuantifier}`;
}
function timeRegex(args) {
  return new RegExp(`^${timeRegexSource(args)}$`);
}
function datetimeRegex(args) {
  let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
  const opts = [];
  opts.push(args.local ? `Z?` : `Z`);
  if (args.offset)
    opts.push(`([+-]\\d{2}:?\\d{2})`);
  regex = `${regex}(${opts.join("|")})`;
  return new RegExp(`^${regex}$`);
}
function isValidIP(ip, version) {
  if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
    return true;
  }
  return false;
}
function isValidJWT(jwt, alg) {
  if (!jwtRegex.test(jwt))
    return false;
  try {
    const [header] = jwt.split(".");
    if (!header)
      return false;
    const base64 = header.replace(/-/g, "+").replace(/_/g, "/").padEnd(header.length + (4 - header.length % 4) % 4, "=");
    const decoded = JSON.parse(atob(base64));
    if (typeof decoded !== "object" || decoded === null)
      return false;
    if ("typ" in decoded && decoded?.typ !== "JWT")
      return false;
    if (!decoded.alg)
      return false;
    if (alg && decoded.alg !== alg)
      return false;
    return true;
  } catch {
    return false;
  }
}
function isValidCidr(ip, version) {
  if ((version === "v4" || !version) && ipv4CidrRegex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6CidrRegex.test(ip)) {
    return true;
  }
  return false;
}
var ZodString = class _ZodString extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = String(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.string) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.string,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.length < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.length > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "length") {
        const tooBig = input.data.length > check.value;
        const tooSmall = input.data.length < check.value;
        if (tooBig || tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          if (tooBig) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          } else if (tooSmall) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          }
          status.dirty();
        }
      } else if (check.kind === "email") {
        if (!emailRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "email",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "emoji") {
        if (!emojiRegex) {
          emojiRegex = new RegExp(_emojiRegex, "u");
        }
        if (!emojiRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "emoji",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "uuid") {
        if (!uuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "uuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "nanoid") {
        if (!nanoidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "nanoid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid") {
        if (!cuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid2") {
        if (!cuid2Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid2",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ulid") {
        if (!ulidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ulid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "url") {
        try {
          new URL(input.data);
        } catch {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "regex") {
        check.regex.lastIndex = 0;
        const testResult = check.regex.test(input.data);
        if (!testResult) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "regex",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "trim") {
        input.data = input.data.trim();
      } else if (check.kind === "includes") {
        if (!input.data.includes(check.value, check.position)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { includes: check.value, position: check.position },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "toLowerCase") {
        input.data = input.data.toLowerCase();
      } else if (check.kind === "toUpperCase") {
        input.data = input.data.toUpperCase();
      } else if (check.kind === "startsWith") {
        if (!input.data.startsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { startsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "endsWith") {
        if (!input.data.endsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { endsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "datetime") {
        const regex = datetimeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "datetime",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "date") {
        const regex = dateRegex;
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "date",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "time") {
        const regex = timeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "time",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "duration") {
        if (!durationRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "duration",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ip") {
        if (!isValidIP(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ip",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "jwt") {
        if (!isValidJWT(input.data, check.alg)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "jwt",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cidr") {
        if (!isValidCidr(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cidr",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64") {
        if (!base64Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64url") {
        if (!base64urlRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _regex(regex, validation, message) {
    return this.refinement((data) => regex.test(data), {
      validation,
      code: ZodIssueCode.invalid_string,
      ...errorUtil.errToObj(message)
    });
  }
  _addCheck(check) {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  email(message) {
    return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
  }
  url(message) {
    return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
  }
  emoji(message) {
    return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
  }
  uuid(message) {
    return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
  }
  nanoid(message) {
    return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
  }
  cuid(message) {
    return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
  }
  cuid2(message) {
    return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
  }
  ulid(message) {
    return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
  }
  base64(message) {
    return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
  }
  base64url(message) {
    return this._addCheck({
      kind: "base64url",
      ...errorUtil.errToObj(message)
    });
  }
  jwt(options) {
    return this._addCheck({ kind: "jwt", ...errorUtil.errToObj(options) });
  }
  ip(options) {
    return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
  }
  cidr(options) {
    return this._addCheck({ kind: "cidr", ...errorUtil.errToObj(options) });
  }
  datetime(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "datetime",
        precision: null,
        offset: false,
        local: false,
        message: options
      });
    }
    return this._addCheck({
      kind: "datetime",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      offset: options?.offset ?? false,
      local: options?.local ?? false,
      ...errorUtil.errToObj(options?.message)
    });
  }
  date(message) {
    return this._addCheck({ kind: "date", message });
  }
  time(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "time",
        precision: null,
        message: options
      });
    }
    return this._addCheck({
      kind: "time",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      ...errorUtil.errToObj(options?.message)
    });
  }
  duration(message) {
    return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
  }
  regex(regex, message) {
    return this._addCheck({
      kind: "regex",
      regex,
      ...errorUtil.errToObj(message)
    });
  }
  includes(value, options) {
    return this._addCheck({
      kind: "includes",
      value,
      position: options?.position,
      ...errorUtil.errToObj(options?.message)
    });
  }
  startsWith(value, message) {
    return this._addCheck({
      kind: "startsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  endsWith(value, message) {
    return this._addCheck({
      kind: "endsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  min(minLength, message) {
    return this._addCheck({
      kind: "min",
      value: minLength,
      ...errorUtil.errToObj(message)
    });
  }
  max(maxLength, message) {
    return this._addCheck({
      kind: "max",
      value: maxLength,
      ...errorUtil.errToObj(message)
    });
  }
  length(len, message) {
    return this._addCheck({
      kind: "length",
      value: len,
      ...errorUtil.errToObj(message)
    });
  }
  /**
   * Equivalent to `.min(1)`
   */
  nonempty(message) {
    return this.min(1, errorUtil.errToObj(message));
  }
  trim() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "trim" }]
    });
  }
  toLowerCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toLowerCase" }]
    });
  }
  toUpperCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toUpperCase" }]
    });
  }
  get isDatetime() {
    return !!this._def.checks.find((ch) => ch.kind === "datetime");
  }
  get isDate() {
    return !!this._def.checks.find((ch) => ch.kind === "date");
  }
  get isTime() {
    return !!this._def.checks.find((ch) => ch.kind === "time");
  }
  get isDuration() {
    return !!this._def.checks.find((ch) => ch.kind === "duration");
  }
  get isEmail() {
    return !!this._def.checks.find((ch) => ch.kind === "email");
  }
  get isURL() {
    return !!this._def.checks.find((ch) => ch.kind === "url");
  }
  get isEmoji() {
    return !!this._def.checks.find((ch) => ch.kind === "emoji");
  }
  get isUUID() {
    return !!this._def.checks.find((ch) => ch.kind === "uuid");
  }
  get isNANOID() {
    return !!this._def.checks.find((ch) => ch.kind === "nanoid");
  }
  get isCUID() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid");
  }
  get isCUID2() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid2");
  }
  get isULID() {
    return !!this._def.checks.find((ch) => ch.kind === "ulid");
  }
  get isIP() {
    return !!this._def.checks.find((ch) => ch.kind === "ip");
  }
  get isCIDR() {
    return !!this._def.checks.find((ch) => ch.kind === "cidr");
  }
  get isBase64() {
    return !!this._def.checks.find((ch) => ch.kind === "base64");
  }
  get isBase64url() {
    return !!this._def.checks.find((ch) => ch.kind === "base64url");
  }
  get minLength() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxLength() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodString.create = (params) => {
  return new ZodString({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodString,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
function floatSafeRemainder(val, step) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepDecCount = (step.toString().split(".")[1] || "").length;
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
  return valInt % stepInt / 10 ** decCount;
}
var ZodNumber = class _ZodNumber extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
    this.step = this.multipleOf;
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = Number(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.number) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.number,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "int") {
        if (!util.isInteger(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: "integer",
            received: "float",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (floatSafeRemainder(input.data, check.value) !== 0) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "finite") {
        if (!Number.isFinite(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_finite,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodNumber({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodNumber({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  int(message) {
    return this._addCheck({
      kind: "int",
      message: errorUtil.toString(message)
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  finite(message) {
    return this._addCheck({
      kind: "finite",
      message: errorUtil.toString(message)
    });
  }
  safe(message) {
    return this._addCheck({
      kind: "min",
      inclusive: true,
      value: Number.MIN_SAFE_INTEGER,
      message: errorUtil.toString(message)
    })._addCheck({
      kind: "max",
      inclusive: true,
      value: Number.MAX_SAFE_INTEGER,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
  get isInt() {
    return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
  }
  get isFinite() {
    let max = null;
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
        return true;
      } else if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      } else if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return Number.isFinite(min) && Number.isFinite(max);
  }
};
ZodNumber.create = (params) => {
  return new ZodNumber({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodNumber,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodBigInt = class _ZodBigInt extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
  }
  _parse(input) {
    if (this._def.coerce) {
      try {
        input.data = BigInt(input.data);
      } catch {
        return this._getInvalidInput(input);
      }
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.bigint) {
      return this._getInvalidInput(input);
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            type: "bigint",
            minimum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            type: "bigint",
            maximum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (input.data % check.value !== BigInt(0)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _getInvalidInput(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.bigint,
      received: ctx.parsedType
    });
    return INVALID;
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodBigInt({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodBigInt({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodBigInt.create = (params) => {
  return new ZodBigInt({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodBigInt,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
var ZodBoolean = class extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = Boolean(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.boolean) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.boolean,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodBoolean.create = (params) => {
  return new ZodBoolean({
    typeName: ZodFirstPartyTypeKind.ZodBoolean,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodDate = class _ZodDate extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = new Date(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.date) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.date,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    if (Number.isNaN(input.data.getTime())) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_date
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.getTime() < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            message: check.message,
            inclusive: true,
            exact: false,
            minimum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.getTime() > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            message: check.message,
            inclusive: true,
            exact: false,
            maximum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return {
      status: status.value,
      value: new Date(input.data.getTime())
    };
  }
  _addCheck(check) {
    return new _ZodDate({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  min(minDate, message) {
    return this._addCheck({
      kind: "min",
      value: minDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  max(maxDate, message) {
    return this._addCheck({
      kind: "max",
      value: maxDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  get minDate() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min != null ? new Date(min) : null;
  }
  get maxDate() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max != null ? new Date(max) : null;
  }
};
ZodDate.create = (params) => {
  return new ZodDate({
    checks: [],
    coerce: params?.coerce || false,
    typeName: ZodFirstPartyTypeKind.ZodDate,
    ...processCreateParams(params)
  });
};
var ZodSymbol = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.symbol) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.symbol,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodSymbol.create = (params) => {
  return new ZodSymbol({
    typeName: ZodFirstPartyTypeKind.ZodSymbol,
    ...processCreateParams(params)
  });
};
var ZodUndefined = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.undefined,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodUndefined.create = (params) => {
  return new ZodUndefined({
    typeName: ZodFirstPartyTypeKind.ZodUndefined,
    ...processCreateParams(params)
  });
};
var ZodNull = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.null) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.null,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodNull.create = (params) => {
  return new ZodNull({
    typeName: ZodFirstPartyTypeKind.ZodNull,
    ...processCreateParams(params)
  });
};
var ZodAny = class extends ZodType {
  constructor() {
    super(...arguments);
    this._any = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodAny.create = (params) => {
  return new ZodAny({
    typeName: ZodFirstPartyTypeKind.ZodAny,
    ...processCreateParams(params)
  });
};
var ZodUnknown = class extends ZodType {
  constructor() {
    super(...arguments);
    this._unknown = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodUnknown.create = (params) => {
  return new ZodUnknown({
    typeName: ZodFirstPartyTypeKind.ZodUnknown,
    ...processCreateParams(params)
  });
};
var ZodNever = class extends ZodType {
  _parse(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.never,
      received: ctx.parsedType
    });
    return INVALID;
  }
};
ZodNever.create = (params) => {
  return new ZodNever({
    typeName: ZodFirstPartyTypeKind.ZodNever,
    ...processCreateParams(params)
  });
};
var ZodVoid = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.void,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodVoid.create = (params) => {
  return new ZodVoid({
    typeName: ZodFirstPartyTypeKind.ZodVoid,
    ...processCreateParams(params)
  });
};
var ZodArray = class _ZodArray extends ZodType {
  _parse(input) {
    const { ctx, status } = this._processInputParams(input);
    const def = this._def;
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (def.exactLength !== null) {
      const tooBig = ctx.data.length > def.exactLength.value;
      const tooSmall = ctx.data.length < def.exactLength.value;
      if (tooBig || tooSmall) {
        addIssueToContext(ctx, {
          code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
          minimum: tooSmall ? def.exactLength.value : void 0,
          maximum: tooBig ? def.exactLength.value : void 0,
          type: "array",
          inclusive: true,
          exact: true,
          message: def.exactLength.message
        });
        status.dirty();
      }
    }
    if (def.minLength !== null) {
      if (ctx.data.length < def.minLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.minLength.message
        });
        status.dirty();
      }
    }
    if (def.maxLength !== null) {
      if (ctx.data.length > def.maxLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.maxLength.message
        });
        status.dirty();
      }
    }
    if (ctx.common.async) {
      return Promise.all([...ctx.data].map((item, i) => {
        return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
      })).then((result2) => {
        return ParseStatus.mergeArray(status, result2);
      });
    }
    const result = [...ctx.data].map((item, i) => {
      return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
    });
    return ParseStatus.mergeArray(status, result);
  }
  get element() {
    return this._def.type;
  }
  min(minLength, message) {
    return new _ZodArray({
      ...this._def,
      minLength: { value: minLength, message: errorUtil.toString(message) }
    });
  }
  max(maxLength, message) {
    return new _ZodArray({
      ...this._def,
      maxLength: { value: maxLength, message: errorUtil.toString(message) }
    });
  }
  length(len, message) {
    return new _ZodArray({
      ...this._def,
      exactLength: { value: len, message: errorUtil.toString(message) }
    });
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodArray.create = (schema, params) => {
  return new ZodArray({
    type: schema,
    minLength: null,
    maxLength: null,
    exactLength: null,
    typeName: ZodFirstPartyTypeKind.ZodArray,
    ...processCreateParams(params)
  });
};
function deepPartialify(schema) {
  if (schema instanceof ZodObject) {
    const newShape = {};
    for (const key in schema.shape) {
      const fieldSchema = schema.shape[key];
      newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
    }
    return new ZodObject({
      ...schema._def,
      shape: () => newShape
    });
  } else if (schema instanceof ZodArray) {
    return new ZodArray({
      ...schema._def,
      type: deepPartialify(schema.element)
    });
  } else if (schema instanceof ZodOptional) {
    return ZodOptional.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodNullable) {
    return ZodNullable.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodTuple) {
    return ZodTuple.create(schema.items.map((item) => deepPartialify(item)));
  } else {
    return schema;
  }
}
var ZodObject = class _ZodObject extends ZodType {
  constructor() {
    super(...arguments);
    this._cached = null;
    this.nonstrict = this.passthrough;
    this.augment = this.extend;
  }
  _getCached() {
    if (this._cached !== null)
      return this._cached;
    const shape = this._def.shape();
    const keys = util.objectKeys(shape);
    this._cached = { shape, keys };
    return this._cached;
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.object) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const { status, ctx } = this._processInputParams(input);
    const { shape, keys: shapeKeys } = this._getCached();
    const extraKeys = [];
    if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
      for (const key in ctx.data) {
        if (!shapeKeys.includes(key)) {
          extraKeys.push(key);
        }
      }
    }
    const pairs = [];
    for (const key of shapeKeys) {
      const keyValidator = shape[key];
      const value = ctx.data[key];
      pairs.push({
        key: { status: "valid", value: key },
        value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (this._def.catchall instanceof ZodNever) {
      const unknownKeys = this._def.unknownKeys;
      if (unknownKeys === "passthrough") {
        for (const key of extraKeys) {
          pairs.push({
            key: { status: "valid", value: key },
            value: { status: "valid", value: ctx.data[key] }
          });
        }
      } else if (unknownKeys === "strict") {
        if (extraKeys.length > 0) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.unrecognized_keys,
            keys: extraKeys
          });
          status.dirty();
        }
      } else if (unknownKeys === "strip") {
      } else {
        throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
      }
    } else {
      const catchall = this._def.catchall;
      for (const key of extraKeys) {
        const value = ctx.data[key];
        pairs.push({
          key: { status: "valid", value: key },
          value: catchall._parse(
            new ParseInputLazyPath(ctx, value, ctx.path, key)
            //, ctx.child(key), value, getParsedType(value)
          ),
          alwaysSet: key in ctx.data
        });
      }
    }
    if (ctx.common.async) {
      return Promise.resolve().then(async () => {
        const syncPairs = [];
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          syncPairs.push({
            key,
            value,
            alwaysSet: pair.alwaysSet
          });
        }
        return syncPairs;
      }).then((syncPairs) => {
        return ParseStatus.mergeObjectSync(status, syncPairs);
      });
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get shape() {
    return this._def.shape();
  }
  strict(message) {
    errorUtil.errToObj;
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strict",
      ...message !== void 0 ? {
        errorMap: (issue, ctx) => {
          const defaultError = this._def.errorMap?.(issue, ctx).message ?? ctx.defaultError;
          if (issue.code === "unrecognized_keys")
            return {
              message: errorUtil.errToObj(message).message ?? defaultError
            };
          return {
            message: defaultError
          };
        }
      } : {}
    });
  }
  strip() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strip"
    });
  }
  passthrough() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "passthrough"
    });
  }
  // const AugmentFactory =
  //   <Def extends ZodObjectDef>(def: Def) =>
  //   <Augmentation extends ZodRawShape>(
  //     augmentation: Augmentation
  //   ): ZodObject<
  //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
  //     Def["unknownKeys"],
  //     Def["catchall"]
  //   > => {
  //     return new ZodObject({
  //       ...def,
  //       shape: () => ({
  //         ...def.shape(),
  //         ...augmentation,
  //       }),
  //     }) as any;
  //   };
  extend(augmentation) {
    return new _ZodObject({
      ...this._def,
      shape: () => ({
        ...this._def.shape(),
        ...augmentation
      })
    });
  }
  /**
   * Prior to zod@1.0.12 there was a bug in the
   * inferred type of merged objects. Please
   * upgrade if you are experiencing issues.
   */
  merge(merging) {
    const merged = new _ZodObject({
      unknownKeys: merging._def.unknownKeys,
      catchall: merging._def.catchall,
      shape: () => ({
        ...this._def.shape(),
        ...merging._def.shape()
      }),
      typeName: ZodFirstPartyTypeKind.ZodObject
    });
    return merged;
  }
  // merge<
  //   Incoming extends AnyZodObject,
  //   Augmentation extends Incoming["shape"],
  //   NewOutput extends {
  //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
  //       ? Augmentation[k]["_output"]
  //       : k extends keyof Output
  //       ? Output[k]
  //       : never;
  //   },
  //   NewInput extends {
  //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
  //       ? Augmentation[k]["_input"]
  //       : k extends keyof Input
  //       ? Input[k]
  //       : never;
  //   }
  // >(
  //   merging: Incoming
  // ): ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"],
  //   NewOutput,
  //   NewInput
  // > {
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  setKey(key, schema) {
    return this.augment({ [key]: schema });
  }
  // merge<Incoming extends AnyZodObject>(
  //   merging: Incoming
  // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
  // ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"]
  // > {
  //   // const mergedShape = objectUtil.mergeShapes(
  //   //   this._def.shape(),
  //   //   merging._def.shape()
  //   // );
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  catchall(index) {
    return new _ZodObject({
      ...this._def,
      catchall: index
    });
  }
  pick(mask) {
    const shape = {};
    for (const key of util.objectKeys(mask)) {
      if (mask[key] && this.shape[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  omit(mask) {
    const shape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (!mask[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  /**
   * @deprecated
   */
  deepPartial() {
    return deepPartialify(this);
  }
  partial(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      const fieldSchema = this.shape[key];
      if (mask && !mask[key]) {
        newShape[key] = fieldSchema;
      } else {
        newShape[key] = fieldSchema.optional();
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  required(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (mask && !mask[key]) {
        newShape[key] = this.shape[key];
      } else {
        const fieldSchema = this.shape[key];
        let newField = fieldSchema;
        while (newField instanceof ZodOptional) {
          newField = newField._def.innerType;
        }
        newShape[key] = newField;
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  keyof() {
    return createZodEnum(util.objectKeys(this.shape));
  }
};
ZodObject.create = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.strictCreate = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strict",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.lazycreate = (shape, params) => {
  return new ZodObject({
    shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
var ZodUnion = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const options = this._def.options;
    function handleResults(results) {
      for (const result of results) {
        if (result.result.status === "valid") {
          return result.result;
        }
      }
      for (const result of results) {
        if (result.result.status === "dirty") {
          ctx.common.issues.push(...result.ctx.common.issues);
          return result.result;
        }
      }
      const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return Promise.all(options.map(async (option) => {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        return {
          result: await option._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: childCtx
          }),
          ctx: childCtx
        };
      })).then(handleResults);
    } else {
      let dirty = void 0;
      const issues = [];
      for (const option of options) {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        const result = option._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: childCtx
        });
        if (result.status === "valid") {
          return result;
        } else if (result.status === "dirty" && !dirty) {
          dirty = { result, ctx: childCtx };
        }
        if (childCtx.common.issues.length) {
          issues.push(childCtx.common.issues);
        }
      }
      if (dirty) {
        ctx.common.issues.push(...dirty.ctx.common.issues);
        return dirty.result;
      }
      const unionErrors = issues.map((issues2) => new ZodError(issues2));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
  }
  get options() {
    return this._def.options;
  }
};
ZodUnion.create = (types, params) => {
  return new ZodUnion({
    options: types,
    typeName: ZodFirstPartyTypeKind.ZodUnion,
    ...processCreateParams(params)
  });
};
var getDiscriminator = (type) => {
  if (type instanceof ZodLazy) {
    return getDiscriminator(type.schema);
  } else if (type instanceof ZodEffects) {
    return getDiscriminator(type.innerType());
  } else if (type instanceof ZodLiteral) {
    return [type.value];
  } else if (type instanceof ZodEnum) {
    return type.options;
  } else if (type instanceof ZodNativeEnum) {
    return util.objectValues(type.enum);
  } else if (type instanceof ZodDefault) {
    return getDiscriminator(type._def.innerType);
  } else if (type instanceof ZodUndefined) {
    return [void 0];
  } else if (type instanceof ZodNull) {
    return [null];
  } else if (type instanceof ZodOptional) {
    return [void 0, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodNullable) {
    return [null, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodBranded) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodReadonly) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodCatch) {
    return getDiscriminator(type._def.innerType);
  } else {
    return [];
  }
};
var ZodDiscriminatedUnion = class _ZodDiscriminatedUnion extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const discriminator = this.discriminator;
    const discriminatorValue = ctx.data[discriminator];
    const option = this.optionsMap.get(discriminatorValue);
    if (!option) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union_discriminator,
        options: Array.from(this.optionsMap.keys()),
        path: [discriminator]
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return option._parseAsync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    } else {
      return option._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    }
  }
  get discriminator() {
    return this._def.discriminator;
  }
  get options() {
    return this._def.options;
  }
  get optionsMap() {
    return this._def.optionsMap;
  }
  /**
   * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
   * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
   * have a different value for each object in the union.
   * @param discriminator the name of the discriminator property
   * @param types an array of object schemas
   * @param params
   */
  static create(discriminator, options, params) {
    const optionsMap = /* @__PURE__ */ new Map();
    for (const type of options) {
      const discriminatorValues = getDiscriminator(type.shape[discriminator]);
      if (!discriminatorValues.length) {
        throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
      }
      for (const value of discriminatorValues) {
        if (optionsMap.has(value)) {
          throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
        }
        optionsMap.set(value, type);
      }
    }
    return new _ZodDiscriminatedUnion({
      typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
      discriminator,
      options,
      optionsMap,
      ...processCreateParams(params)
    });
  }
};
function mergeValues(a, b) {
  const aType = getParsedType(a);
  const bType = getParsedType(b);
  if (a === b) {
    return { valid: true, data: a };
  } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
    const bKeys = util.objectKeys(b);
    const sharedKeys = util.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues(a[key], b[key]);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
    if (a.length !== b.length) {
      return { valid: false };
    }
    const newArray = [];
    for (let index = 0; index < a.length; index++) {
      const itemA = a[index];
      const itemB = b[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b) {
    return { valid: true, data: a };
  } else {
    return { valid: false };
  }
}
var ZodIntersection = class extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const handleParsed = (parsedLeft, parsedRight) => {
      if (isAborted(parsedLeft) || isAborted(parsedRight)) {
        return INVALID;
      }
      const merged = mergeValues(parsedLeft.value, parsedRight.value);
      if (!merged.valid) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_intersection_types
        });
        return INVALID;
      }
      if (isDirty(parsedLeft) || isDirty(parsedRight)) {
        status.dirty();
      }
      return { status: status.value, value: merged.data };
    };
    if (ctx.common.async) {
      return Promise.all([
        this._def.left._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }),
        this._def.right._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        })
      ]).then(([left, right]) => handleParsed(left, right));
    } else {
      return handleParsed(this._def.left._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }), this._def.right._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }));
    }
  }
};
ZodIntersection.create = (left, right, params) => {
  return new ZodIntersection({
    left,
    right,
    typeName: ZodFirstPartyTypeKind.ZodIntersection,
    ...processCreateParams(params)
  });
};
var ZodTuple = class _ZodTuple extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (ctx.data.length < this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_small,
        minimum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      return INVALID;
    }
    const rest = this._def.rest;
    if (!rest && ctx.data.length > this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_big,
        maximum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      status.dirty();
    }
    const items = [...ctx.data].map((item, itemIndex) => {
      const schema = this._def.items[itemIndex] || this._def.rest;
      if (!schema)
        return null;
      return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
    }).filter((x) => !!x);
    if (ctx.common.async) {
      return Promise.all(items).then((results) => {
        return ParseStatus.mergeArray(status, results);
      });
    } else {
      return ParseStatus.mergeArray(status, items);
    }
  }
  get items() {
    return this._def.items;
  }
  rest(rest) {
    return new _ZodTuple({
      ...this._def,
      rest
    });
  }
};
ZodTuple.create = (schemas, params) => {
  if (!Array.isArray(schemas)) {
    throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
  }
  return new ZodTuple({
    items: schemas,
    typeName: ZodFirstPartyTypeKind.ZodTuple,
    rest: null,
    ...processCreateParams(params)
  });
};
var ZodRecord = class _ZodRecord extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const pairs = [];
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    for (const key in ctx.data) {
      pairs.push({
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
        value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (ctx.common.async) {
      return ParseStatus.mergeObjectAsync(status, pairs);
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get element() {
    return this._def.valueType;
  }
  static create(first, second, third) {
    if (second instanceof ZodType) {
      return new _ZodRecord({
        keyType: first,
        valueType: second,
        typeName: ZodFirstPartyTypeKind.ZodRecord,
        ...processCreateParams(third)
      });
    }
    return new _ZodRecord({
      keyType: ZodString.create(),
      valueType: first,
      typeName: ZodFirstPartyTypeKind.ZodRecord,
      ...processCreateParams(second)
    });
  }
};
var ZodMap = class extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.map) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.map,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    const pairs = [...ctx.data.entries()].map(([key, value], index) => {
      return {
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
        value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"]))
      };
    });
    if (ctx.common.async) {
      const finalMap = /* @__PURE__ */ new Map();
      return Promise.resolve().then(async () => {
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          if (key.status === "aborted" || value.status === "aborted") {
            return INVALID;
          }
          if (key.status === "dirty" || value.status === "dirty") {
            status.dirty();
          }
          finalMap.set(key.value, value.value);
        }
        return { status: status.value, value: finalMap };
      });
    } else {
      const finalMap = /* @__PURE__ */ new Map();
      for (const pair of pairs) {
        const key = pair.key;
        const value = pair.value;
        if (key.status === "aborted" || value.status === "aborted") {
          return INVALID;
        }
        if (key.status === "dirty" || value.status === "dirty") {
          status.dirty();
        }
        finalMap.set(key.value, value.value);
      }
      return { status: status.value, value: finalMap };
    }
  }
};
ZodMap.create = (keyType, valueType, params) => {
  return new ZodMap({
    valueType,
    keyType,
    typeName: ZodFirstPartyTypeKind.ZodMap,
    ...processCreateParams(params)
  });
};
var ZodSet = class _ZodSet extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.set) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.set,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const def = this._def;
    if (def.minSize !== null) {
      if (ctx.data.size < def.minSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.minSize.message
        });
        status.dirty();
      }
    }
    if (def.maxSize !== null) {
      if (ctx.data.size > def.maxSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.maxSize.message
        });
        status.dirty();
      }
    }
    const valueType = this._def.valueType;
    function finalizeSet(elements2) {
      const parsedSet = /* @__PURE__ */ new Set();
      for (const element of elements2) {
        if (element.status === "aborted")
          return INVALID;
        if (element.status === "dirty")
          status.dirty();
        parsedSet.add(element.value);
      }
      return { status: status.value, value: parsedSet };
    }
    const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
    if (ctx.common.async) {
      return Promise.all(elements).then((elements2) => finalizeSet(elements2));
    } else {
      return finalizeSet(elements);
    }
  }
  min(minSize, message) {
    return new _ZodSet({
      ...this._def,
      minSize: { value: minSize, message: errorUtil.toString(message) }
    });
  }
  max(maxSize, message) {
    return new _ZodSet({
      ...this._def,
      maxSize: { value: maxSize, message: errorUtil.toString(message) }
    });
  }
  size(size, message) {
    return this.min(size, message).max(size, message);
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodSet.create = (valueType, params) => {
  return new ZodSet({
    valueType,
    minSize: null,
    maxSize: null,
    typeName: ZodFirstPartyTypeKind.ZodSet,
    ...processCreateParams(params)
  });
};
var ZodFunction = class _ZodFunction extends ZodType {
  constructor() {
    super(...arguments);
    this.validate = this.implement;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.function) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.function,
        received: ctx.parsedType
      });
      return INVALID;
    }
    function makeArgsIssue(args, error) {
      return makeIssue({
        data: args,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_arguments,
          argumentsError: error
        }
      });
    }
    function makeReturnsIssue(returns, error) {
      return makeIssue({
        data: returns,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_return_type,
          returnTypeError: error
        }
      });
    }
    const params = { errorMap: ctx.common.contextualErrorMap };
    const fn = ctx.data;
    if (this._def.returns instanceof ZodPromise) {
      const me2 = this;
      return OK(async function(...args) {
        const error = new ZodError([]);
        const parsedArgs = await me2._def.args.parseAsync(args, params).catch((e) => {
          error.addIssue(makeArgsIssue(args, e));
          throw error;
        });
        const result = await Reflect.apply(fn, this, parsedArgs);
        const parsedReturns = await me2._def.returns._def.type.parseAsync(result, params).catch((e) => {
          error.addIssue(makeReturnsIssue(result, e));
          throw error;
        });
        return parsedReturns;
      });
    } else {
      const me2 = this;
      return OK(function(...args) {
        const parsedArgs = me2._def.args.safeParse(args, params);
        if (!parsedArgs.success) {
          throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
        }
        const result = Reflect.apply(fn, this, parsedArgs.data);
        const parsedReturns = me2._def.returns.safeParse(result, params);
        if (!parsedReturns.success) {
          throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
        }
        return parsedReturns.data;
      });
    }
  }
  parameters() {
    return this._def.args;
  }
  returnType() {
    return this._def.returns;
  }
  args(...items) {
    return new _ZodFunction({
      ...this._def,
      args: ZodTuple.create(items).rest(ZodUnknown.create())
    });
  }
  returns(returnType) {
    return new _ZodFunction({
      ...this._def,
      returns: returnType
    });
  }
  implement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  strictImplement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  static create(args, returns, params) {
    return new _ZodFunction({
      args: args ? args : ZodTuple.create([]).rest(ZodUnknown.create()),
      returns: returns || ZodUnknown.create(),
      typeName: ZodFirstPartyTypeKind.ZodFunction,
      ...processCreateParams(params)
    });
  }
};
var ZodLazy = class extends ZodType {
  get schema() {
    return this._def.getter();
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const lazySchema = this._def.getter();
    return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
  }
};
ZodLazy.create = (getter, params) => {
  return new ZodLazy({
    getter,
    typeName: ZodFirstPartyTypeKind.ZodLazy,
    ...processCreateParams(params)
  });
};
var ZodLiteral = class extends ZodType {
  _parse(input) {
    if (input.data !== this._def.value) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_literal,
        expected: this._def.value
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
  get value() {
    return this._def.value;
  }
};
ZodLiteral.create = (value, params) => {
  return new ZodLiteral({
    value,
    typeName: ZodFirstPartyTypeKind.ZodLiteral,
    ...processCreateParams(params)
  });
};
function createZodEnum(values, params) {
  return new ZodEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodEnum,
    ...processCreateParams(params)
  });
}
var ZodEnum = class _ZodEnum extends ZodType {
  _parse(input) {
    if (typeof input.data !== "string") {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(this._def.values);
    }
    if (!this._cache.has(input.data)) {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get options() {
    return this._def.values;
  }
  get enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Values() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  extract(values, newDef = this._def) {
    return _ZodEnum.create(values, {
      ...this._def,
      ...newDef
    });
  }
  exclude(values, newDef = this._def) {
    return _ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
      ...this._def,
      ...newDef
    });
  }
};
ZodEnum.create = createZodEnum;
var ZodNativeEnum = class extends ZodType {
  _parse(input) {
    const nativeEnumValues = util.getValidEnumValues(this._def.values);
    const ctx = this._getOrReturnCtx(input);
    if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(util.getValidEnumValues(this._def.values));
    }
    if (!this._cache.has(input.data)) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get enum() {
    return this._def.values;
  }
};
ZodNativeEnum.create = (values, params) => {
  return new ZodNativeEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
    ...processCreateParams(params)
  });
};
var ZodPromise = class extends ZodType {
  unwrap() {
    return this._def.type;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.promise,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
    return OK(promisified.then((data) => {
      return this._def.type.parseAsync(data, {
        path: ctx.path,
        errorMap: ctx.common.contextualErrorMap
      });
    }));
  }
};
ZodPromise.create = (schema, params) => {
  return new ZodPromise({
    type: schema,
    typeName: ZodFirstPartyTypeKind.ZodPromise,
    ...processCreateParams(params)
  });
};
var ZodEffects = class extends ZodType {
  innerType() {
    return this._def.schema;
  }
  sourceType() {
    return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const effect = this._def.effect || null;
    const checkCtx = {
      addIssue: (arg) => {
        addIssueToContext(ctx, arg);
        if (arg.fatal) {
          status.abort();
        } else {
          status.dirty();
        }
      },
      get path() {
        return ctx.path;
      }
    };
    checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
    if (effect.type === "preprocess") {
      const processed = effect.transform(ctx.data, checkCtx);
      if (ctx.common.async) {
        return Promise.resolve(processed).then(async (processed2) => {
          if (status.value === "aborted")
            return INVALID;
          const result = await this._def.schema._parseAsync({
            data: processed2,
            path: ctx.path,
            parent: ctx
          });
          if (result.status === "aborted")
            return INVALID;
          if (result.status === "dirty")
            return DIRTY(result.value);
          if (status.value === "dirty")
            return DIRTY(result.value);
          return result;
        });
      } else {
        if (status.value === "aborted")
          return INVALID;
        const result = this._def.schema._parseSync({
          data: processed,
          path: ctx.path,
          parent: ctx
        });
        if (result.status === "aborted")
          return INVALID;
        if (result.status === "dirty")
          return DIRTY(result.value);
        if (status.value === "dirty")
          return DIRTY(result.value);
        return result;
      }
    }
    if (effect.type === "refinement") {
      const executeRefinement = (acc) => {
        const result = effect.refinement(acc, checkCtx);
        if (ctx.common.async) {
          return Promise.resolve(result);
        }
        if (result instanceof Promise) {
          throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
        }
        return acc;
      };
      if (ctx.common.async === false) {
        const inner = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inner.status === "aborted")
          return INVALID;
        if (inner.status === "dirty")
          status.dirty();
        executeRefinement(inner.value);
        return { status: status.value, value: inner.value };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
          if (inner.status === "aborted")
            return INVALID;
          if (inner.status === "dirty")
            status.dirty();
          return executeRefinement(inner.value).then(() => {
            return { status: status.value, value: inner.value };
          });
        });
      }
    }
    if (effect.type === "transform") {
      if (ctx.common.async === false) {
        const base = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (!isValid(base))
          return INVALID;
        const result = effect.transform(base.value, checkCtx);
        if (result instanceof Promise) {
          throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
        }
        return { status: status.value, value: result };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
          if (!isValid(base))
            return INVALID;
          return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({
            status: status.value,
            value: result
          }));
        });
      }
    }
    util.assertNever(effect);
  }
};
ZodEffects.create = (schema, effect, params) => {
  return new ZodEffects({
    schema,
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    effect,
    ...processCreateParams(params)
  });
};
ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
  return new ZodEffects({
    schema,
    effect: { type: "preprocess", transform: preprocess },
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    ...processCreateParams(params)
  });
};
var ZodOptional = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.undefined) {
      return OK(void 0);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodOptional.create = (type, params) => {
  return new ZodOptional({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodOptional,
    ...processCreateParams(params)
  });
};
var ZodNullable = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.null) {
      return OK(null);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodNullable.create = (type, params) => {
  return new ZodNullable({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodNullable,
    ...processCreateParams(params)
  });
};
var ZodDefault = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    let data = ctx.data;
    if (ctx.parsedType === ZodParsedType.undefined) {
      data = this._def.defaultValue();
    }
    return this._def.innerType._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  removeDefault() {
    return this._def.innerType;
  }
};
ZodDefault.create = (type, params) => {
  return new ZodDefault({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodDefault,
    defaultValue: typeof params.default === "function" ? params.default : () => params.default,
    ...processCreateParams(params)
  });
};
var ZodCatch = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const newCtx = {
      ...ctx,
      common: {
        ...ctx.common,
        issues: []
      }
    };
    const result = this._def.innerType._parse({
      data: newCtx.data,
      path: newCtx.path,
      parent: {
        ...newCtx
      }
    });
    if (isAsync(result)) {
      return result.then((result2) => {
        return {
          status: "valid",
          value: result2.status === "valid" ? result2.value : this._def.catchValue({
            get error() {
              return new ZodError(newCtx.common.issues);
            },
            input: newCtx.data
          })
        };
      });
    } else {
      return {
        status: "valid",
        value: result.status === "valid" ? result.value : this._def.catchValue({
          get error() {
            return new ZodError(newCtx.common.issues);
          },
          input: newCtx.data
        })
      };
    }
  }
  removeCatch() {
    return this._def.innerType;
  }
};
ZodCatch.create = (type, params) => {
  return new ZodCatch({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodCatch,
    catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
    ...processCreateParams(params)
  });
};
var ZodNaN = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.nan) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.nan,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
};
ZodNaN.create = (params) => {
  return new ZodNaN({
    typeName: ZodFirstPartyTypeKind.ZodNaN,
    ...processCreateParams(params)
  });
};
var BRAND = Symbol("zod_brand");
var ZodBranded = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const data = ctx.data;
    return this._def.type._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  unwrap() {
    return this._def.type;
  }
};
var ZodPipeline = class _ZodPipeline extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.common.async) {
      const handleAsync = async () => {
        const inResult = await this._def.in._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inResult.status === "aborted")
          return INVALID;
        if (inResult.status === "dirty") {
          status.dirty();
          return DIRTY(inResult.value);
        } else {
          return this._def.out._parseAsync({
            data: inResult.value,
            path: ctx.path,
            parent: ctx
          });
        }
      };
      return handleAsync();
    } else {
      const inResult = this._def.in._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
      if (inResult.status === "aborted")
        return INVALID;
      if (inResult.status === "dirty") {
        status.dirty();
        return {
          status: "dirty",
          value: inResult.value
        };
      } else {
        return this._def.out._parseSync({
          data: inResult.value,
          path: ctx.path,
          parent: ctx
        });
      }
    }
  }
  static create(a, b) {
    return new _ZodPipeline({
      in: a,
      out: b,
      typeName: ZodFirstPartyTypeKind.ZodPipeline
    });
  }
};
var ZodReadonly = class extends ZodType {
  _parse(input) {
    const result = this._def.innerType._parse(input);
    const freeze = (data) => {
      if (isValid(data)) {
        data.value = Object.freeze(data.value);
      }
      return data;
    };
    return isAsync(result) ? result.then((data) => freeze(data)) : freeze(result);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodReadonly.create = (type, params) => {
  return new ZodReadonly({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodReadonly,
    ...processCreateParams(params)
  });
};
function cleanParams(params, data) {
  const p = typeof params === "function" ? params(data) : typeof params === "string" ? { message: params } : params;
  const p2 = typeof p === "string" ? { message: p } : p;
  return p2;
}
function custom(check, _params = {}, fatal) {
  if (check)
    return ZodAny.create().superRefine((data, ctx) => {
      const r = check(data);
      if (r instanceof Promise) {
        return r.then((r2) => {
          if (!r2) {
            const params = cleanParams(_params, data);
            const _fatal = params.fatal ?? fatal ?? true;
            ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
          }
        });
      }
      if (!r) {
        const params = cleanParams(_params, data);
        const _fatal = params.fatal ?? fatal ?? true;
        ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
      }
      return;
    });
  return ZodAny.create();
}
var late = {
  object: ZodObject.lazycreate
};
var ZodFirstPartyTypeKind;
(function(ZodFirstPartyTypeKind2) {
  ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
  ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
  ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
  ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
  ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
  ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
  ZodFirstPartyTypeKind2["ZodSymbol"] = "ZodSymbol";
  ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
  ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
  ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
  ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
  ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
  ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
  ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
  ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
  ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
  ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
  ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
  ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
  ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
  ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
  ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
  ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
  ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
  ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
  ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
  ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
  ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
  ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
  ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
  ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
  ZodFirstPartyTypeKind2["ZodCatch"] = "ZodCatch";
  ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
  ZodFirstPartyTypeKind2["ZodBranded"] = "ZodBranded";
  ZodFirstPartyTypeKind2["ZodPipeline"] = "ZodPipeline";
  ZodFirstPartyTypeKind2["ZodReadonly"] = "ZodReadonly";
})(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
var instanceOfType = (cls, params = {
  message: `Input not instance of ${cls.name}`
}) => custom((data) => data instanceof cls, params);
var stringType = ZodString.create;
var numberType = ZodNumber.create;
var nanType = ZodNaN.create;
var bigIntType = ZodBigInt.create;
var booleanType = ZodBoolean.create;
var dateType = ZodDate.create;
var symbolType = ZodSymbol.create;
var undefinedType = ZodUndefined.create;
var nullType = ZodNull.create;
var anyType = ZodAny.create;
var unknownType = ZodUnknown.create;
var neverType = ZodNever.create;
var voidType = ZodVoid.create;
var arrayType = ZodArray.create;
var objectType = ZodObject.create;
var strictObjectType = ZodObject.strictCreate;
var unionType = ZodUnion.create;
var discriminatedUnionType = ZodDiscriminatedUnion.create;
var intersectionType = ZodIntersection.create;
var tupleType = ZodTuple.create;
var recordType = ZodRecord.create;
var mapType = ZodMap.create;
var setType = ZodSet.create;
var functionType = ZodFunction.create;
var lazyType = ZodLazy.create;
var literalType = ZodLiteral.create;
var enumType = ZodEnum.create;
var nativeEnumType = ZodNativeEnum.create;
var promiseType = ZodPromise.create;
var effectsType = ZodEffects.create;
var optionalType = ZodOptional.create;
var nullableType = ZodNullable.create;
var preprocessType = ZodEffects.createWithPreprocess;
var pipelineType = ZodPipeline.create;
var ostring = () => stringType().optional();
var onumber = () => numberType().optional();
var oboolean = () => booleanType().optional();
var coerce = {
  string: ((arg) => ZodString.create({ ...arg, coerce: true })),
  number: ((arg) => ZodNumber.create({ ...arg, coerce: true })),
  boolean: ((arg) => ZodBoolean.create({
    ...arg,
    coerce: true
  })),
  bigint: ((arg) => ZodBigInt.create({ ...arg, coerce: true })),
  date: ((arg) => ZodDate.create({ ...arg, coerce: true }))
};
var NEVER = INVALID;

// packages/shared/src/map.ts
var mapPoint = external_exports.object({ x: external_exports.number().finite().min(0).max(100), y: external_exports.number().finite().min(0).max(100) }).strict();
var anchorSchema = mapPoint.extend({ worldX: external_exports.number().finite().min(-1e6).max(1e6), worldZ: external_exports.number().finite().min(-1e6).max(1e6) }).strict();
var calibrationSchema = external_exports.array(anchorSchema).length(3).refine((a) => a.length === 3 && Math.abs(determinant(a)) > 1e-6, "Choose three non-collinear world locations.").refine((a) => a.length === 3 && Math.abs((a[1].x - a[0].x) * (a[2].y - a[0].y) - (a[2].x - a[0].x) * (a[1].y - a[0].y)) > 1e-3, "Choose three non-collinear image locations.");
function determinant(a) {
  return (a[1].worldX - a[0].worldX) * (a[2].worldZ - a[0].worldZ) - (a[2].worldX - a[0].worldX) * (a[1].worldZ - a[0].worldZ);
}
function unprojectPoint(anchors, point) {
  if (!calibrationSchema.safeParse(anchors).success) return null;
  const [a, b, c] = anchors, dx = point.x - a.x, dy = point.y - a.y, d = (b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y), u = (dx * (c.y - a.y) - (c.x - a.x) * dy) / d, v = ((b.x - a.x) * dy - dx * (b.y - a.y)) / d;
  return { worldX: a.worldX + u * (b.worldX - a.worldX) + v * (c.worldX - a.worldX), worldZ: a.worldZ + u * (b.worldZ - a.worldZ) + v * (c.worldZ - a.worldZ) };
}
var mapFeatureSchema = external_exports.object({ kind: external_exports.enum(["station", "postal", "roadblock", "patrol"]), agency: external_exports.enum(["police", "sheriff", "fire", "ems", "dot", "dispatch"]), label: external_exports.string().trim().min(1).max(100), notes: external_exports.string().trim().max(1e3).default(""), points: external_exports.array(mapPoint).min(1).max(40) }).strict().superRefine((value, ctx) => {
  if (value.kind === "patrol") {
    if (value.points.length < 3) ctx.addIssue({ code: "custom", message: "A patrol boundary needs at least three points." });
    else {
      const area = value.points.reduce((sum, p, i) => {
        const q = value.points[(i + 1) % value.points.length];
        return sum + p.x * q.y - q.x * p.y;
      }, 0);
      if (Math.abs(area) < 0.01) ctx.addIssue({ code: "custom", message: "Patrol boundary must enclose an area." });
    }
  } else if (value.points.length !== 1) ctx.addIssue({ code: "custom", message: "Point features need exactly one location." });
});

// apps/web/src/map.ts
var el = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== void 0) node.textContent = text;
  if (className) node.className = className;
  return node;
};
var svgNode = (tag, attributes = {}) => {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attributes).forEach(([k, v]) => node.setAttribute(k, String(v)));
  return node;
};
var color = (agency) => ({ police: "#a7caff", sheriff: "#d8c9a2", fire: "#ecaeb8", ems: "#b1ddcf", dot: "#d9d1b1", dispatch: "#ffffff" })[agency] ?? "#dce5f4";
async function renderLiveMap(content, c) {
  const data = await c.api("/map"), heading2 = el("div", void 0, "page-head"), title = el("div");
  title.append(el("h1", "Live ER:LC map"), el("p", "Official map imagery \u2022 last-known telemetry and manual CAD overlays", "muted"));
  heading2.append(title);
  content.append(heading2);
  const button = (label, fn) => {
    const b = el("button", label);
    b.type = "button";
    b.onclick = () => {
      Promise.resolve().then(fn).catch((e) => c.toast(e instanceof Error ? e.message : "Map action failed."));
    };
    return b;
  };
  const freshness = el("div", void 0, "notice");
  const updateFreshness = () => {
    const at = data.telemetry.at ? new Date(data.telemetry.at).getTime() : 0, seconds = at ? Math.max(0, Math.floor((Date.now() - at) / 1e3)) : null;
    freshness.textContent = `${!data.telemetry.healthy || seconds === null || seconds > 120 ? "STALE / UNAVAILABLE" : "API SNAPSHOT"} \u2022 ${seconds === null ? "No telemetry received" : seconds + " seconds old"} \u2022 ${data.config.anchors.length === 3 ? "Measured calibration active" : "Telemetry markers await calibration"} \u2022 Manual CAD pins are separately labeled.`;
  };
  updateFreshness();
  content.append(freshness);
  const freshnessTimer = window.setInterval(() => {
    if (!freshness.isConnected) {
      clearInterval(freshnessTimer);
      return;
    }
    updateFreshness();
    data.telemetry.stale = !data.telemetry.healthy || !data.telemetry.at || Date.now() - new Date(data.telemetry.at).getTime() > 12e4;
    draw();
  }, 5e3);
  let variant = "fall_postals", view = { x: 0, y: 0, size: 100 }, tool = "pan", suppressMarkerClick = false, draft = [], anchors = [], selectedPoint = null;
  try {
    const saved = JSON.parse(sessionStorage.getItem("lasrp-map-view") ?? "null");
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y) && saved.size >= 100 / 12 && saved.size <= 100) view = saved;
    const savedVariant = localStorage.getItem("lasrp-map-variant");
    if (data.variants.some((v) => v.id === savedVariant && v.installed)) variant = savedVariant;
  } catch {
  }
  const toolbar2 = el("div", void 0, "toolbar map-toolbar"), select = document.createElement("select");
  select.setAttribute("aria-label", "Map image");
  data.variants.forEach((v) => {
    const option = new Option(v.id.replaceAll("_", " ") + (v.installed ? "" : " \u2014 not installed"), v.id);
    option.disabled = !v.installed;
    select.add(option);
  });
  select.value = variant;
  const layerNames = ["players", "units", "incidents", "station", "postal", "roadblock", "patrol"];
  const layers = el("div", void 0, "toolbar map-layers");
  let visible = new Set(layerNames);
  try {
    const saved = JSON.parse(localStorage.getItem("lasrp-map-layers") ?? "null");
    if (Array.isArray(saved)) visible = new Set(saved.filter((s) => layerNames.includes(s)));
  } catch {
  }
  const stage = el("div", void 0, "map-stage"), svg = svgNode("svg", { viewBox: `${view.x} ${view.y} ${view.size} ${view.size}`, role: "img", "aria-label": "Interactive official ERLC map. Drag to pan, use zoom buttons or the mouse wheel. Pin tools place fictional CAD records.", tabindex: "0" }), image = svgNode("image", { x: 0, y: 0, width: 100, height: 100, preserveAspectRatio: "none" }), overlay = svgNode("g");
  image.setAttribute("href", "/api/map/image/" + variant);
  svg.append(image, overlay);
  stage.append(svg);
  const instructions = el("p", "Drag to pan. Zoom buttons or mouse wheel zoom around the pointer. Select a tool, then click the map.", "muted");
  const status = el("p", "Pan mode", "map-coordinate-readout");
  let imageReady = false;
  image.addEventListener("load", () => {
    imageReady = true;
  });
  image.addEventListener("error", () => {
    imageReady = false;
    status.textContent = "Map image could not load. Run npm run map:fetch, then refresh.";
  });
  const applyView = () => {
    svg.setAttribute("viewBox", `${view.x} ${view.y} ${view.size} ${view.size}`);
    sessionStorage.setItem("lasrp-map-view", JSON.stringify(view));
  };
  const zoom = (factor, p = { x: view.x + view.size / 2, y: view.y + view.size / 2 }) => {
    const size = Math.max(100 / 12, Math.min(100, view.size * factor)), ratio = size / view.size;
    view = { x: Math.max(-20, Math.min(120 - size, p.x - (p.x - view.x) * ratio)), y: Math.max(-20, Math.min(120 - size, p.y - (p.y - view.y) * ratio)), size };
    applyView();
  };
  const position = (event) => {
    const rect = svg.getBoundingClientRect(), scale = Math.min(rect.width, rect.height) / view.size;
    return { x: view.x + (event.clientX - rect.left - (rect.width - view.size * scale) / 2) / scale, y: view.y + (event.clientY - rect.top - (rect.height - view.size * scale) / 2) / scale };
  };
  const marker = (point, label, agency, action, shape = "circle", stale = false) => {
    const g = svgNode("g", { tabindex: 0, role: "button", "aria-label": label, class: `map-pin${stale ? " map-stale" : ""}` }), title2 = svgNode("title");
    title2.textContent = label;
    g.append(title2);
    const dot = shape === "rect" ? svgNode("rect", { x: point.x - 0.55, y: point.y - 0.55, width: 1.1, height: 1.1, fill: color(agency) }) : svgNode("circle", { cx: point.x, cy: point.y, r: 0.55, fill: color(agency) });
    dot.setAttribute("stroke", "#07152d");
    dot.setAttribute("stroke-width", ".17");
    g.append(dot);
    const text = svgNode("text", { x: point.x + 0.9, y: point.y + 0.35, "font-size": 1.05, fill: "#fff", "paint-order": "stroke", stroke: "#07152d", "stroke-width": 0.25 });
    text.textContent = label.slice(0, 45);
    g.append(text);
    const activate = () => Promise.resolve().then(action).catch((e) => c.toast(e.message));
    g.addEventListener("click", (e) => {
      if (tool === "pan") {
        e.stopPropagation();
        if (!suppressMarkerClick) void activate();
        suppressMarkerClick = false;
      }
    });
    g.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        void activate();
      }
    });
    overlay.append(g);
  };
  const details = (title2, value, actions = []) => {
    const body = el("div");
    body.append(el("h2", title2));
    for (const [key, v] of Object.entries(value)) body.append(el("p", key + ": " + (typeof v === "object" ? JSON.stringify(v) : String(v ?? "Not supplied"))));
    c.show(body, actions);
  };
  function draw() {
    overlay.replaceChildren();
    for (const row of data.features) {
      const f = row.data;
      if (!visible.has(f.kind)) continue;
      if (f.kind === "patrol") {
        const poly = svgNode("polygon", { points: f.points.map((p) => `${p.x},${p.y}`).join(" "), fill: color(row.agency), "fill-opacity": 0.12, stroke: color(row.agency), "stroke-width": 0.3, "stroke-dasharray": ".8 .5" });
        overlay.append(poly);
      }
      marker(f.points[0], f.label, row.agency, () => details(f.label, { agency: row.agency, type: f.kind, notes: f.notes, source: "MANUAL_ROLEPLAY" }, data.canDraw ? [button("Archive feature", () => c.form("Archive map feature", [{ name: "reason", label: "Reason", type: "textarea", max: 500 }], async (d) => {
        await c.api("/map/features/" + row.id, "DELETE", { ...d, version: row.version });
        c.toast("Feature archived. Refresh the map.");
      }))] : []), f.kind === "roadblock" ? "rect" : "circle");
    }
    if (visible.has("incidents")) {
      for (const i of data.incidents) if (i.coordinates?.mapRevision === data.config.revision) marker(i.coordinates, `P${i.priority} ${i.type}`, i.agency, async () => c.openIncident(await c.api("/incidents/" + i.id)), "rect");
    }
    if (visible.has("units")) {
      for (const unit of data.units) if (unit.coordinates?.mapRevision === data.config.revision) marker(unit.coordinates, unit.callsign + " [manual]", unit.agency, () => details(unit.callsign, { status: unit.status, location: unit.location, source: "MANUAL_ROLEPLAY", locationReportedAt: unit.coordinates.reportedAt ?? "Unknown" }), "rect", Date.now() - new Date(unit.coordinates.reportedAt ?? 0).getTime() > data.unitFreshnessMinutes * 6e4);
    }
    if (visible.has("players")) {
      for (const player of data.players) if (player.point) marker(player.point, `${player.callsign || player.player} [API]`, /sheriff/i.test(player.team) ? "sheriff" : /fire/i.test(player.team) ? "fire" : /police/i.test(player.team) ? "police" : /ems/i.test(player.team) ? "ems" : "dispatch", () => details(player.player, { team: player.team, callsign: player.callsign, location: player.location, source: "ERLC_API", snapshot: data.telemetry.at }), "circle", data.telemetry.stale);
    }
    if (draft.length) {
      overlay.append(svgNode("polyline", { points: draft.map((p) => `${p.x},${p.y}`).join(" "), fill: "none", stroke: "#fff", "stroke-width": 0.3 }));
      draft.forEach((p, i) => marker(p, "Boundary " + (i + 1), "dispatch", () => {
      }));
    }
    anchors.forEach((a, i) => marker(a, "Anchor " + (i + 1), "dispatch", () => {
    }));
  }
  select.onchange = () => {
    variant = select.value;
    imageReady = false;
    image.setAttribute("href", "/api/map/image/" + variant);
    localStorage.setItem("lasrp-map-variant", variant);
  };
  for (const name of layerNames) {
    const label = el("label", name), input = document.createElement("input");
    input.type = "checkbox";
    input.checked = visible.has(name);
    input.onchange = () => {
      input.checked ? visible.add(name) : visible.delete(name);
      localStorage.setItem("lasrp-map-layers", JSON.stringify([...visible]));
      draw();
    };
    label.prepend(input);
    layers.append(label);
  }
  const choose = (name) => {
    tool = name;
    draft = [];
    anchors = [];
    status.textContent = name === "calibrate" ? "Calibration: click three known locations and enter measured world X/Z values." : "Tool: " + name;
    draw();
  };
  toolbar2.append(select, button("Zoom in", () => zoom(0.75)), button("Zoom out", () => zoom(1 / 0.75)), button("Fit map", () => {
    view = { x: 0, y: 0, size: 100 };
    applyView();
  }), button("Pan", () => choose("pan")));
  if (data.canDraw) {
    for (const name of ["station", "postal", "roadblock", "patrol", "incident"]) toolbar2.append(button(name === "incident" ? "Place incident" : name, () => choose(name)));
    toolbar2.append(button("Finish boundary", () => {
      if (tool !== "patrol" || draft.length < 3) {
        c.toast("Select patrol and click at least three boundary points.");
        return;
      }
      saveFeature("patrol", draft.slice());
    }));
  }
  if (data.units.some((u) => u.userId === c.userId)) toolbar2.append(button("Place my unit", () => choose("unit")));
  if (data.canManage) toolbar2.append(button("Calibrate", () => choose("calibrate")), button("Clear calibration", () => c.form("Clear measured calibration", [{ name: "confirm", label: "Type CLEAR to confirm" }], async (d) => {
    if (d.confirm !== "CLEAR") throw Error("Type CLEAR to confirm.");
    await c.api("/map/calibration", "PUT", { version: data.config.version, anchors: [] });
    c.toast("Calibration cleared. Refresh the map.");
  })));
  const agencies = ["police", "sheriff", "fire", "ems", "dot", "dispatch"].filter((a) => c.has("dispatcher", "supervisor", a));
  function saveFeature(kind, points) {
    c.form("Add " + kind, [{ name: "label", label: kind === "postal" ? "Postal label" : "Label", max: 100 }, { name: "agency", label: "Agency", type: "select", options: agencies }, { name: "notes", label: "Fictional operational notes", type: "textarea", required: false, max: 1e3 }], async (d) => {
      await c.api("/map/features", "POST", { ...d, kind, points });
      choose("pan");
      c.toast("Map feature saved. Refresh to see shared changes.");
    }, "Map features are manually placed community records. They do not place objects inside Roblox.");
  }
  let pointer = null;
  svg.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    const event = e;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, viewX: view.x, viewY: view.y };
    suppressMarkerClick = false;
    if (tool === "pan" && !event.target.closest(".map-pin")) svg.setPointerCapture?.(event.pointerId);
  });
  svg.addEventListener("pointermove", (e) => {
    const event = e, p = position(event);
    selectedPoint = p;
    const world = unprojectPoint(data.config.anchors, p);
    status.textContent = `${tool} \u2022 image ${p.x.toFixed(2)}%, ${p.y.toFixed(2)}%${world ? ` \u2022 world X ${world.worldX.toFixed(1)}, Z ${world.worldZ.toFixed(1)}` : ""}${tool === "patrol" ? " \u2022 " + draft.length + " boundary points" : ""}`;
    if (pointer && tool === "pan") {
      const rect = svg.getBoundingClientRect(), scale = Math.min(rect.width, rect.height) / view.size;
      view.x = Math.max(-20, Math.min(120 - view.size, pointer.viewX - (event.clientX - pointer.startX) / scale));
      view.y = Math.max(-20, Math.min(120 - view.size, pointer.viewY - (event.clientY - pointer.startY) / scale));
      applyView();
    }
  });
  svg.addEventListener("pointercancel", () => {
    pointer = null;
  });
  svg.addEventListener("pointerup", (e) => {
    const event = e, start = pointer;
    pointer = null;
    suppressMarkerClick = Boolean(start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6);
    if (!start || suppressMarkerClick || tool === "pan") return;
    const point = position(event);
    if (!imageReady) {
      c.toast("Wait for the official map image to finish loading.");
      return;
    }
    if (point.x < 0 || point.x > 100 || point.y < 0 || point.y > 100) return;
    if (tool === "patrol") {
      if (draft.length >= 40) {
        c.toast("A boundary supports up to 40 points.");
        return;
      }
      draft.push(point);
      draw();
      return;
    }
    if (tool === "calibrate") {
      c.form("Measured calibration anchor " + (anchors.length + 1), [{ name: "worldX", label: "Measured ER:LC World X", type: "number" }, { name: "worldZ", label: "Measured ER:LC World Z", type: "number" }], async (d) => {
        const candidate = [...anchors, { ...point, worldX: Number(d.worldX), worldZ: Number(d.worldZ) }];
        if (candidate.length === 3) {
          await c.api("/map/calibration", "PUT", { version: data.config.version, anchors: candidate });
          choose("pan");
          c.toast("Calibration saved. Refresh to plot supported API locations.");
        } else {
          anchors = candidate;
          draw();
        }
      }, "Use an observed world position at this exact map location. Spread anchors across the map; avoid a straight line.");
      return;
    }
    if (tool === "unit") {
      const unit = data.units.find((u) => u.userId === c.userId);
      c.form("Confirm manual unit location", [{ name: "confirm", label: "Type PLACE to confirm" }], async (d) => {
        if (d.confirm !== "PLACE") throw Error("Type PLACE to confirm.");
        const current = await c.api("/summary");
        const own = current.units.find((u) => u.id === unit.id);
        await c.api("/map/unit", "PUT", { version: own.version, point });
        choose("pan");
        c.toast("Manual unit location saved.");
      });
      return;
    }
    if (tool === "incident") {
      c.form("Place existing incident", [{ name: "id", label: "Open incident", type: "select", choices: data.incidents.map((i) => ({ label: i.type + " \u2022 " + i.location, value: i.id })) }], async (d) => {
        const incident = await c.api("/incidents/" + d.id);
        await c.api("/incidents/" + d.id, "PATCH", { version: incident.version, coordinates: { ...point, mapRevision: data.config.revision } });
        choose("pan");
        c.toast("Incident map location saved.");
      });
      return;
    }
    saveFeature(tool, [point]);
  });
  svg.addEventListener("wheel", (event) => {
    const e = event;
    e.preventDefault();
    zoom(e.deltaY > 0 ? 1.12 : 1 / 1.12, position(e));
  }, { passive: false });
  svg.addEventListener("keydown", (event) => {
    const e = event;
    if (e.key === "Escape") {
      choose("pan");
      return;
    }
    if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      zoom(0.8);
    }
    if (e.key === "-") {
      e.preventDefault();
      zoom(1.25);
    }
    if (e.key.startsWith("Arrow")) {
      e.preventDefault();
      const step = view.size * 0.1;
      view.x += e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
      view.y += e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
      applyView();
    }
  });
  const search = el("input");
  search.placeholder = "Find callsign, player, postal or overlay";
  search.setAttribute("aria-label", "Search map");
  toolbar2.append(search, button("Find", () => {
    const q = search.value.trim().toLowerCase();
    if (!q) return;
    const feature = data.features.find((f) => f.data.label.toLowerCase().includes(q)), player = data.players.find((p) => (p.player + " " + p.callsign + " " + (p.location?.PostalCode ?? "")).toLowerCase().includes(q) && p.point), point = feature?.data.points[0] ?? player?.point;
    if (!point) {
      c.toast("No mapped match. Telemetry positions require calibration.");
      return;
    }
    view = { x: point.x - 10, y: point.y - 10, size: 20 };
    applyView();
  }));
  content.append(toolbar2, layers, stage, status, instructions, el("p", "Map artwork: Police Roleplay Community / ER:LC. Fall and snow postal maps use the official published postal labels. Station pins and patrol boundaries are community annotations.", "muted"));
  const unplaced = data.incidents.filter((i) => i.coordinates?.mapRevision !== data.config.revision).length, unprojected = data.players.filter((p) => !p.point).length;
  content.append(el("p", `${unplaced} open incidents need map pins \u2022 ${unprojected} visible players have missing, out-of-bounds or uncalibrated positions. Legacy planning-grid coordinates are not assumed to be geographic.`, "notice"));
  const list = el("section", void 0, "card");
  list.append(el("h2", "Last-known player locations"));
  for (const p of data.players) {
    const row = el("p", `${p.callsign || p.player} \u2022 ${p.team} \u2022 ${p.location ? `${p.location.StreetName ?? ""} / ${p.location.PostalCode ?? ""} \u2022 X ${p.location.LocationX}, Z ${p.location.LocationZ}` : "Location not supplied"}`);
    list.append(row);
  }
  if (!data.players.length) list.append(el("p", "No authorized player location snapshot is available."));
  content.append(list);
  draw();
}

// apps/web/src/app.ts
var root = document.getElementById("app");
var dialog = document.getElementById("dialog");
var me;
var section = "Dashboard";
var summary = {};
var page = 0;
var selectedAgency = "police";
var selectedKind = "incident_report";
var socket;
var refreshTimer;
var operationalKind = "fire";
function editReportDetails(record) {
  const current = record.data.details;
  if (!current) return;
  const labels = { vehicles: "Fictional involved vehicles", injuries: "Minimal fictional injury summary", basis: "Fictional authority / justification", forceUsed: "Fictional force and outcome", alias: "Fictional witness alias", statement: "Fictional witness statement", items: "Fictional seized inventory", service: "Assistance type", outcome: "Action and outcome" };
  const fields = Object.keys(current).filter((key) => key !== "type").map((key) => ({ name: key, label: labels[key] ?? key, type: key === "service" ? "select" : "textarea", ...key === "service" ? { options: ["disabled_vehicle", "debris", "road_closure", "traffic_control"] } : {}, value: current[key], required: key !== "injuries", wide: true, max: key === "statement" ? 3e3 : key === "alias" ? 80 : key === "items" ? 1500 : 1e3 }));
  form("Revise structured report details", fields, async (values) => {
    await api("/records/" + record.id, "PATCH", { version: record.version, data: { ...record.data, details: { type: current.type, ...values } } });
  });
}
async function downloadCad(path, filename, body) {
  const response = await fetch("/api" + path, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", "X-CSRF-Token": me.csrf }, body: body ? JSON.stringify(body) : void 0 });
  if (!response.ok) {
    const error = await response.json();
    throw Error(error.error ?? "Export failed.");
  }
  const url = URL.createObjectURL(await response.blob()), link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 6e4);
}
async function physicalCustody(evidence) {
  const state = await api("/evidence/" + evidence.id + "/physical-custody"), body = detail("Fictional physical evidence handoff", { file: evidence.originalName, custodian: state.custodianId, status: state.status, location: state.location, pendingRecipient: state.pendingTo ?? "None" }), actions = [];
  if (state.canOffer && state.status !== "pending") actions.push(btn("Offer handoff", () => form("Offer physical evidence transfer", [{ name: "toId", label: "Receiving on-duty custodian Discord ID" }, { name: "location", label: "Fictional handoff location", max: 150 }, { name: "reason", label: "Transfer reason", type: "textarea", wide: true, max: 1e3 }], async (d) => {
    await api("/evidence/" + evidence.id + "/physical-custody", "POST", { ...d, version: state.version });
  })));
  if (state.pendingTo === me.user.id) for (const accept of [true, false]) actions.push(btn(accept ? "Accept handoff" : "Reject handoff", () => form("Acknowledge evidence transfer", [{ name: "note", label: "Receipt / rejection note", type: "textarea", wide: true, max: 1e3 }], async (d) => {
    await api("/evidence/" + evidence.id + "/physical-custody/respond", "POST", { ...d, accept, version: state.version });
  })));
  show(body, actions);
}
async function mutualAidPage(content) {
  heading(content, "Mutual aid", "Separate agency response calls linked to the original incident.", has("dispatcher", "supervisor") ? [btn("Request aid", async () => {
    const incidents = await api("/incidents");
    form("Request mutual aid", [{ name: "incidentId", label: "Source incident", type: "select", choices: incidents.filter((i) => i.status !== "closed").map((i) => ({ label: i.type + " \u2022 " + i.location, value: i.id })) }, { name: "agency", label: "Receiving agency", type: "select", options: ["police", "sheriff", "fire", "ems", "dot"] }, { name: "summary", label: "Details shared with receiving agency", type: "textarea", wide: true, max: 1500 }], async (d) => {
      const source = await api("/incidents/" + d.incidentId);
      await api("/mutual-aid", "POST", { ...d, version: source.version });
    });
  }, "primary")] : []);
  const rows = await api("/mutual-aid?page=" + page), box = card("Aid coordination");
  for (const row of rows) {
    const item = $("div", "record");
    item.append($("h3", "", row.data.title), badge(row.status), $("p", "", `${row.data.sourceAgency} \u2192 ${row.agency} \u2022 ${row.data.location}`), $("p", "", row.data.narrative));
    if (row.data.responseIncidentId) item.append($("p", "muted", "Receiving response call: " + row.data.responseIncidentId), btn("Open response call", async () => openIncident(await api("/incidents/" + row.data.responseIncidentId)), "small"));
    if (has("dispatcher", "supervisor")) for (const status of row.status === "requested" ? ["accepted", "declined", "cancelled"] : row.status === "accepted" ? ["completed"] : []) item.append(btn(status, () => form("Mutual aid: " + status, [{ name: "reason", label: "Reason / response", type: "textarea", wide: true, max: 1e3 }], async (d) => {
      await api("/mutual-aid/" + row.id + "/respond", "POST", { ...d, status, version: row.version });
    }), "small"));
    box.append(item);
  }
  if (!rows.length) box.append(empty("No mutual aid requests", "Authorized dispatch/supervisors can request assistance from another agency."));
  content.append(box);
  paginate(content, rows.length);
}
function bulkExport() {
  form("Export CAD records", [{ name: "recordIds", label: "Authorized record IDs (one per line, maximum 20)", type: "textarea", wide: true }, { name: "includeEvidence", label: "Include original evidence and custody logs (maximum 32 MiB)", type: "checkbox", required: false }], async (d) => {
    await downloadCad("/exports", "LASRP-CAD-export.zip", { recordIds: d.recordIds.split("\n").map((s) => s.trim()).filter(Boolean), includeEvidence: d.includeEvidence });
  }, "The ZIP includes full JSON records, PDF copies, audit history and a SHA-256 manifest.");
}
async function investigationTasks(row) {
  const result = await api("/legal/" + row.id + "/tasks"), box = card("Investigation task board");
  for (const task of result.tasks) {
    const item = $("div", "record");
    item.append($("h3", "", task.title), badge(task.status), $("p", "muted", `Assigned: ${task.assigneeId} \u2022 Due: ${time(task.dueAt)}`));
    const states = { pending: ["in_progress", "cancelled"], in_progress: ["completed", "cancelled"] };
    for (const status of states[task.status] ?? []) item.append(btn(status.replaceAll("_", " "), () => form("Update investigation task", [{ name: "note", label: "Progress / outcome note", type: "textarea", wide: true, max: 1500 }], async (d) => {
      await api("/legal/" + row.id + "/tasks/" + task.id, "PATCH", { ...d, status, version: result.version });
    }), "small"));
    box.append(item);
  }
  show(box, [btn("New task", () => form("Assign investigation task", [{ name: "title", label: "Task", max: 200 }, { name: "assigneeId", label: "Assignee Discord ID (blank for yourself)", required: false }, { name: "dueAt", label: "Deadline with timezone (optional)", required: false }], async (d) => {
    if (!d.assigneeId) delete d.assigneeId;
    if (d.dueAt) d.dueAt = new Date(d.dueAt).toISOString();
    else delete d.dueAt;
    await api("/legal/" + row.id + "/tasks", "POST", { ...d, version: result.version });
  }))]);
}
async function registrationReviews(content) {
  const rows = await api("/registration-reviews?all=true"), box = card("Civilian registration reviews");
  for (const row of rows) {
    const item = $("div", "record");
    item.append($("h3", "", row.data.title), badge(row.status), $("p", "", `${row.data.kind} \u2022 ${row.data.location}`), $("p", "", row.data.description));
    if (row.ownerId !== me.user.id && ["submitted", "approved"].includes(row.status)) item.append(btn("Review registration", () => form("Fictional registration review", [{ name: "status", label: "Decision", type: "select", options: row.status === "submitted" ? ["approved", "denied"] : ["revoked"] }, { name: "reason", label: "Reason sent to applicant", type: "textarea", wide: true, max: 1e3 }], async (d) => {
      await api("/registrations/" + row.id + "/review", "POST", { ...d, version: row.version });
    }), "small"));
    box.append(item);
  }
  if (!rows.length) box.append(empty("No registrations", "Civilian submissions will appear here."));
  content.append(box);
}
async function registrationsPanel(content) {
  const rows = await api("/my-registrations"), characters = await api("/characters"), box = card("Fictional properties, businesses and permits");
  box.append($("p", "muted", "Community roleplay records only. Approval does not purchase property or grant in-game ownership."), btn("Submit registration", () => form("Register fictional property / business / permit", [{ name: "kind", label: "Type", type: "select", options: ["property", "business", "permit"] }, { name: "characterId", label: "Your fictional character", type: "select", choices: characters.map((c) => ({ label: c.name, value: c.id })) }, { name: "title", label: "Name / permit type", max: 120 }, { name: "location", label: "Fictional location", max: 150 }, { name: "description", label: "Roleplay details", type: "textarea", wide: true, max: 2e3 }], async (d) => {
    await api("/my-registrations", "POST", d);
  })));
  for (const row of rows) {
    const item = $("div", "record");
    item.append($("h3", "", row.data.title), badge(row.status), $("p", "", `${row.data.kind} \u2022 ${row.data.location}`), $("p", "", row.data.description), $("p", "muted", row.data.reason ?? "Awaiting management review."));
    box.append(item);
  }
  content.append(box);
}
async function sessionsPage(content) {
  basicSessionsPage(content);
  const board = await api("/session-board"), schedules = card("Upcoming sessions / RSVP");
  for (const schedule of board.schedules) {
    const item = $("div", "record");
    item.append($("h3", "", schedule.note), $("p", "", `${time(schedule.startsAt)} \u2022 ${schedule.reservations} reservations`), btn(schedule.attending ? "Cancel my RSVP" : "RSVP", async () => {
      await api("/schedules/" + schedule.id + "/rsvp", "PUT", { attending: !schedule.attending });
      await renderPage();
    }, "small"));
    schedules.append(item);
  }
  if (!board.schedules.length) schedules.append(empty("No upcoming sessions", "Session hosts schedule sessions in Discord. RSVPs are intentions, not guaranteed in-game slots."));
  content.append(schedules);
  const cards = card("Session scorecards");
  for (const session of board.sessions) {
    const scorecard = board.scorecards.find((r) => r.subjectId === session.id), item = $("div", "record");
    item.append($("h3", "", session.id), $("p", "muted", `${session.status} \u2022 Peak ${session.peakPlayers} \u2022 ${session.observedParticipants} API-observed participants \u2022 ${session.durationMinutes ?? "Active"} minutes`));
    if (scorecard) item.append($("p", "", `Coordination ${scorecard.data.coordination}/5 \u2022 Professionalism ${scorecard.data.professionalism}/5 \u2022 Policy ${scorecard.data.policy}/5`), $("p", "", scorecard.data.narrative));
    if (has("management") && session.status === "ended" && session.hostId !== me.user.id) item.append(btn(scorecard ? "Revise review" : "Review session", () => form("Session quality review", [{ name: "coordination", label: "Coordination (1\u20135)", type: "number", value: scorecard?.data.coordination ?? 3 }, { name: "professionalism", label: "Professionalism (1\u20135)", type: "number", value: scorecard?.data.professionalism ?? 3 }, { name: "policy", label: "Policy adherence (1\u20135)", type: "number", value: scorecard?.data.policy ?? 3 }, { name: "notes", label: "Private feedback", type: "textarea", wide: true, max: 2e3, value: scorecard?.data.narrative ?? "" }], async (d) => {
      await api("/sessions/" + session.id + "/scorecard", "PUT", { ...d, version: scorecard?.version ?? 0 });
    }), "small"));
    cards.append(item);
  }
  content.append(cards);
}
async function resourcePanel(agency) {
  const rows = await api("/resources?agency=" + agency), box = card(agency.toUpperCase() + " stations and apparatus");
  for (const row of rows) {
    const item = $("div", "record");
    item.append($("h3", "", `${row.code} \u2022 ${row.name}`), badge(row.kind), badge(row.status), $("p", "muted", `Station: ${row.stationId ?? "None"} \u2022 Unit: ${row.assignedUnit?.callsign ?? "Unassigned"}`));
    if (has("supervisor")) item.append(btn("Assign / status", () => form("Resource assignment", [{ name: "status", label: "Status", type: "select", options: ["available", "busy", "out_of_service"], value: row.status }, { name: "assignedUnitId", label: "On-duty unit ID (blank to release)", required: false, value: row.assignedUnitId ?? "" }], async (d) => {
      await api("/resources/" + row.id, "PATCH", { ...d, assignedUnitId: d.assignedUnitId || null, version: row.version });
    }), "small"));
    box.append(item);
  }
  show(box, has("supervisor") ? [btn("Add station / apparatus", () => form("Create agency resource", [{ name: "kind", label: "Resource type", type: "select", options: ["station", "apparatus"] }, { name: "code", label: "Unique agency code", max: 30 }, { name: "name", label: "Display name", max: 100 }, { name: "stationId", label: "Station ID (optional for apparatus)", required: false }], async (d) => {
    if (!d.stationId) delete d.stationId;
    await api("/resources", "POST", { ...d, agency });
  }))] : []);
}
async function patientPanel(row) {
  const patients = await api("/operational-cases/" + row.id + "/patients"), box = card("Fictional multi-patient care and transport");
  box.append($("p", "notice", "Use invented aliases and minimal roleplay details. Never enter real medical information."));
  const transitions = { assessed: ["treating", "released"], treating: ["transporting", "released"], transporting: ["arrived"] };
  for (const patient of patients) {
    const item = $("div", "record");
    item.append($("h3", "", patient.alias), badge(patient.triage), badge(patient.status), $("p", "", patient.summary), $("p", "muted", patient.hospital || "No hospital selected"));
    if (transitions[patient.status]?.length) item.append(btn("Update care / transport", () => form("Fictional patient update", [{ name: "status", label: "Next stage", type: "select", options: transitions[patient.status] }, { name: "hospital", label: "Fictional hospital", type: "select", options: ["", ...summary.operationalPolicy?.hospitals ?? []], value: patient.hospital, required: false }, { name: "summary", label: "Minimal fictional care summary", type: "textarea", wide: true, max: 1e3, value: patient.summary }], async (d) => {
      await api("/patients/" + patient.id, "PATCH", { ...d, version: patient.version });
    }), "small"));
    box.append(item);
  }
  show(box, [btn("Add fictional patient", () => form("Fictional patient intake", [{ name: "alias", label: "Invented patient alias", max: 80 }, { name: "triage", label: "Roleplay triage", type: "select", options: ["minor", "delayed", "immediate", "expectant"] }, { name: "characterId", label: "Fictional character ID (optional)", required: false }, { name: "summary", label: "Minimal fictional summary", type: "textarea", wide: true, max: 1e3 }], async (d) => {
    if (!d.characterId) delete d.characterId;
    await api("/operational-cases/" + row.id + "/patients", "POST", d);
  }))]);
}
function panicForm() {
  const unit = summary.units?.find((u) => u.userId === me.user.id);
  if (!unit) {
    toast("Go on duty before sending a unit emergency.");
    return;
  }
  form("Send fictional unit emergency", [{ name: "reason", label: "Emergency details and reported location", type: "textarea", wide: true, max: 500 }], async (d) => {
    const result = await api("/unit/panic", "POST", { ...d, version: unit.version });
    toast(`${result.recipientCount} on-duty recipients notified in CAD.`);
  }, "This sends an urgent CAD alert to your agency and dispatch. It does not contact real emergency services.");
}
async function legalPage(content) {
  selectedAgency = has("police") ? "police" : "sheriff";
  heading(content, "Investigations, warrants and BOLOs", "Fictional case relationships, independent approvals and expiry.", [btn("New case", () => form("Create structured case", [{ name: "kind", label: "Case type", type: "select", options: ["investigation", "warrant", "bolo"] }, { name: "agency", label: "Agency", type: "select", options: availableAgencies().filter((a) => ["police", "sheriff"].includes(a)), value: selectedAgency }, { name: "title", label: "Title", max: 120 }, { name: "narrative", label: "Case narrative", type: "textarea", wide: true, max: 6e3 }, { name: "characterIds", label: "Fictional character IDs (one per line)", type: "textarea", required: false }, { name: "vehicleIds", label: "Vehicle registration IDs (one per line)", type: "textarea", required: false }, { name: "reportIds", label: "Related report IDs (one per line)", type: "textarea", required: false }, { name: "expiresAt", label: "Expiry date/time with timezone (required for warrants and BOLOs)", required: false }], async (d) => {
    for (const key of ["characterIds", "vehicleIds", "reportIds"]) d[key] = d[key].split("\n").map((s) => s.trim()).filter(Boolean);
    if (d.expiresAt) d.expiresAt = new Date(d.expiresAt).toISOString();
    else delete d.expiresAt;
    await api("/legal", "POST", d);
  }), "primary")]);
  const rows = await api("/legal?agency=" + selectedAgency + "&page=" + page), box = card("Case files");
  const states = { investigation: { draft: ["submit", "note"], submitted: ["approve", "deny", "note"], approved: ["close", "note"], denied: ["note"], closed: ["note"] }, warrant: { draft: ["submit", "note"], submitted: ["approve", "deny", "note"], issued: ["cancel", "expire", "note"], denied: ["note"], cancelled: ["note"], expired: ["note"] }, bolo: { active: ["cancel", "expire", "note", "acknowledge"], cancelled: ["note"], expired: ["note"] } };
  for (const row of rows) {
    const item = $("div", "record");
    item.append($("h3", "", row.data.title), badge(row.kind), badge(row.status), $("p", "", row.data.narrative ?? ""), $("p", "muted", `${row.id} \u2022 Expiry: ${time(row.data.expiresAt)}`), btn("Relationships / history", () => show(detail(row.data.title, row)), "small"));
    if (row.data.workflow === "legal_v1") {
      for (const action of states[row.kind]?.[row.status] ?? []) item.append(btn(action, () => form("Case: " + action, [{ name: "reason", label: "Reason / investigative note", type: "textarea", wide: true, max: 2e3 }], async (d) => {
        await api("/legal/" + row.id + "/action", "POST", { ...d, version: row.version, action });
      }), "small"));
      if (row.kind === "investigation") item.append(btn("Tasks", () => investigationTasks(row), "small"));
      item.append(btn("Evidence", () => evidencePanel(row), "small"));
    } else item.append($("p", "muted", "Legacy record: view in Reports."));
    box.append(item);
  }
  if (!rows.length) box.append(empty("No cases", "Create an investigation, warrant request or BOLO."));
  content.append(box);
  paginate(content, rows.length);
}
async function robloxPanel(content) {
  const status = await api("/roblox/status"), box = card("Verified Roblox account");
  if (status.account) {
    box.append($("p", "", `${status.account.username} \u2022 Roblox ID ${status.account.robloxId} \u2022 Verified ${time(status.account.verifiedAt)}`), btn("Unlink account", () => form("Unlink Roblox account", [{ name: "confirm", label: "Type UNLINK to confirm" }], async (d) => {
      if (d.confirm !== "UNLINK") throw Error("Type UNLINK to confirm.");
      await api("/roblox/link", "DELETE", {});
    })));
  } else {
    box.append($("p", "", status.configured ? "Verify account ownership by signing in directly with Roblox." : "Roblox OAuth has not been configured by management."));
    if (status.configured && !me.demo) box.append(btn("Link with Roblox", async () => {
      const result = await api("/roblox/start", "POST", {});
      window.location.assign(result.url);
    }));
  }
  content.append(box);
}
var $ = (tag, className = "", text) => {
  const el2 = document.createElement(tag);
  if (className) el2.className = className;
  if (text !== void 0) el2.textContent = text;
  return el2;
};
var has = (...groups) => me.user.groups.includes("owner") || me.user.groups.includes("management") || groups.some((x) => me.user.groups.includes(x));
var responder = () => has("police", "sheriff", "fire", "ems", "dot", "dispatcher");
function toast(text) {
  const el2 = document.getElementById("toast");
  el2.textContent = text;
  el2.style.display = "block";
  setTimeout(() => el2.style.display = "none", 6500);
}
async function api(path, method = "GET", body) {
  const response = await fetch("/api" + path, { method, headers: { "Content-Type": "application/json", ...me ? { "X-CSRF-Token": me.csrf } : {} }, body: body === void 0 ? void 0 : JSON.stringify(body) });
  const result = await response.json();
  if (response.status === 401) {
    login();
    throw Error("Sign in to continue.");
  }
  if (result.code === "CAD_APPROVAL_REQUIRED" || result.code === "CAD_ADMISSION_UNAVAILABLE") {
    void showAdmission();
    throw Error(result.error);
  }
  if (!response.ok) throw Error(result.error ?? "Request failed");
  return result;
}
var guard = (fn) => async () => {
  try {
    await fn();
  } catch (error) {
    toast(error instanceof Error ? error.message : "Request could not be completed.");
  }
};
function btn(text, action, className = "") {
  const b = $("button", className, text);
  b.type = "button";
  b.onclick = guard(action);
  return b;
}
function badge(text, color2 = "") {
  return $("span", "badge " + color2, text.replaceAll("_", " "));
}
function card(title) {
  const el2 = $("section", "card");
  const head = $("div", "card-head");
  head.append($("h2", "", title));
  el2.append(head);
  return el2;
}
function empty(title, description) {
  const el2 = $("div", "empty");
  el2.append($("strong", "", title), $("span", "", description));
  return el2;
}
function time(value) {
  return value ? new Date(value).toLocaleString() : "Not received";
}
function toolbar(...items) {
  const bar = $("div", "toolbar");
  bar.append(...items);
  return bar;
}
function table(columns, rows) {
  const wrap = $("div", "table-wrap"), t = $("table"), head = $("thead"), tr = $("tr");
  columns.forEach((c) => tr.append($("th", "", c)));
  head.append(tr);
  t.append(head);
  const body = $("tbody");
  rows.forEach((cells) => {
    const row = $("tr");
    cells.forEach((c) => {
      const td = $("td");
      td.append(c);
      row.append(td);
    });
    body.append(row);
  });
  t.append(body);
  wrap.append(t);
  return wrap;
}
function detail(title, value) {
  const box = $("div", "detail");
  box.append($("h2", "", title));
  const list = $("dl");
  Object.entries(value).forEach(([key, v]) => {
    list.append($("dt", "", key.replaceAll("_", " ")), $("dd", "", typeof v === "object" ? JSON.stringify(v, null, 2) : String(v ?? "\u2014")));
  });
  box.append(list);
  return box;
}
function show(content, actions = []) {
  const body = document.getElementById("dialogBody");
  body.replaceChildren(content);
  const a = $("div", "actions");
  a.append(...actions, btn("Close", () => dialog.close()));
  body.append(a);
  if (!dialog.open) dialog.showModal();
}
function form(title, fields, submit, intro) {
  const f = $("form");
  f.append($("h2", "", title));
  if (intro) f.append($("p", "", intro));
  const grid = $("div", "form-grid");
  fields.forEach((field) => {
    const label = $("label", field.wide ? "wide" : "", field.label);
    let input;
    if (field.type === "select" || field.type === "multiselect") {
      const select = document.createElement("select");
      if (field.type === "multiselect") {
        select.multiple = true;
        select.size = 6;
      }
      for (const option of field.choices ?? field.options?.map((o) => ({ label: o.replaceAll("_", " "), value: o })) ?? []) select.add(new Option(option.label, option.value));
      input = select;
    } else if (field.type === "textarea") {
      input = document.createElement("textarea");
    } else {
      input = document.createElement("input");
      input.type = field.type ?? "text";
    }
    input.name = field.name;
    input.required = field.required !== false;
    if (field.value !== void 0) input.value = String(field.value);
    if (field.type === "checkbox") input.checked = Boolean(field.value);
    if (field.max && !(input instanceof HTMLSelectElement)) input.maxLength = field.max;
    label.append(input);
    grid.append(label);
  });
  f.append(grid);
  const submitButton = $("button", "primary", "Save");
  submitButton.type = "submit";
  const actions = $("div", "actions");
  actions.append(btn("Cancel", () => dialog.close()), submitButton);
  f.append(actions);
  f.onsubmit = async (event) => {
    event.preventDefault();
    submitButton.disabled = true;
    const data = {};
    fields.forEach((field) => {
      const el2 = f.elements.namedItem(field.name);
      data[field.name] = field.type === "multiselect" ? Array.from(el2.selectedOptions).map((o) => o.value) : field.type === "number" ? Number(el2.value) : field.type === "checkbox" ? el2.checked : el2.value;
    });
    try {
      await submit(data);
      dialog.close();
      await renderPage();
      toast("Saved. Your workspace is up to date.");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save.");
    } finally {
      submitButton.disabled = false;
    }
  };
  const body = document.getElementById("dialogBody");
  body.replaceChildren(f);
  if (!dialog.open) dialog.showModal();
}
function go(name) {
  section = name;
  page = 0;
  location.hash = encodeURIComponent(name);
  void renderPage();
}
function login() {
  root.replaceChildren();
  const login2 = $("main", "login"), art = $("div", "login-art"), image = document.createElement("img");
  image.src = "/assets/branding/blank-blue-banner.png";
  image.alt = "Official Los Angeles State Roleplay blue artwork";
  art.append(image);
  const caption = $("div", "caption");
  caption.append($("div", "eyebrow", "LOS ANGELES STATE ROLEPLAY"), $("h1", "", "One community.\nA connected response."), $("p", "", "Operations, dispatch, and public safety."));
  art.append(caption);
  const body = $("div", "login-form"), logo = document.createElement("img");
  logo.src = "/assets/branding/la-logo.png";
  logo.className = "logo";
  logo.alt = "LA";
  const sign = $("a", "button", "Continue with Discord");
  sign.href = "/auth/discord";
  body.append(logo, $("div", "eyebrow", "LASRP CAD"), $("h1", "", "Your operations workspace."), $("p", "", "Sign in with your community Discord account. Your assigned roles determine your access to dispatch, agency records, and staff tools."), sign, $("footer", "", "FICTIONAL ER:LC ROLEPLAY \u2022 NO REAL EMERGENCY SERVICES"));
  const errors = { bot_offline: "The Discord bot is offline. Start the LASRP service before signing in.", cancelled: "Discord authorization was cancelled. Try signing in again.", invalid_client: "The Discord OAuth client secret is invalid. The owner must update DISCORD_OAUTH_CLIENT_SECRET in .env.", invalid_grant: "The sign-in code expired or the redirect URL differs from the registered callback. Try again from the configured CAD address.", discord_exchange: "Discord could not complete sign-in. Try again shortly.", membership: "Join the LASRP Discord server using this account before signing in.", state: "Your sign-in session expired or cookies were blocked. Start sign-in again from the configured CAD address." };
  const code = new URLSearchParams(location.search).get("login_error");
  if (code) body.append($("p", "error", errors[code] ?? "Sign-in could not be completed. Try again."));
  login2.append(art, body);
  root.append(login2);
  void fetch("/auth/options").then((r) => r.json()).then((options) => {
    if (options.demo && body.isConnected) body.insertBefore(btn("Local demo sign-in", async () => {
      const response = await fetch("/auth/demo", { method: "POST" });
      if (!response.ok) throw Error("Demo sign-in is disabled.");
      await boot();
    }), body.querySelector("footer"));
  }).catch(() => {
  });
}
function shell() {
  root.replaceChildren();
  const shell2 = $("div", "shell"), aside = $("aside", "sidebar"), brand = $("div", "brand"), logo = document.createElement("img");
  logo.src = "/assets/branding/la-logo.png";
  logo.alt = "LA";
  const brandText = $("div");
  brandText.append($("strong", "", "LASRP CAD"), $("small", "", "LASRP \u2022 CAD / MDT"));
  brand.append(logo, brandText);
  aside.append(brand, $("div", "nav-label", "WORKSPACE"));
  const nav = $("nav");
  const entries = [["Dashboard", "\u25A6", true], ["Dispatch", "\u25C7", true], ["Live Map", "\u229E", responder()], ["Mutual Aid", "\u25C7", responder()], ["Police MDT", "\u25C6", has("police", "sheriff", "dispatcher")], ["Fire / EMS", "\u2726", has("fire", "ems")], ["Traffic Stops", "\u25B1", has("police", "sheriff")], ["Investigations", "\u25C7", has("police", "sheriff")], ["Penal Codes", "\xA7", has("police", "sheriff", "dispatcher", "supervisor", "doj")], ["Notifications", "\u25C7", true], ["Civilian Portal", "\u25A4", true], ["DOJ / Courts", "\xA7", me.features.courts && has("doj")], ["DOT / Towing", "\u25B1", has("dot")], ["Staff Center", "\u25A7", has("moderator", "support", "reviewer", "security")], ["Applications", "\u25A3", true], ["Sessions", "\u25F7", true], ["Reports", "\u25A4", responder()], ["Admin", "\u22EE", has("management")]];
  entries.filter((x) => x[2]).forEach(([name, symbol]) => {
    const b = btn("", () => go(name), section === name ? "active" : "");
    b.append($("span", "symbol", symbol), $("span", "", name));
    nav.append(b);
  });
  aside.append(nav, $("div", "sidebar-footer", "Los Angeles State Roleplay\nOperations & Public Safety\n\nFICTIONAL ROLEPLAY SYSTEM"));
  const main = $("main", "main"), top = $("header", "topbar"), timeEl = $("time", "", (/* @__PURE__ */ new Date()).toLocaleString());
  const identity = $("div", "identity");
  identity.append($("span", "avatar", me.user.name.slice(0, 1).toUpperCase()), $("span", "", me.user.name), btn("Notifications", () => go("Notifications"), "small"), btn("Preferences", editPreferences, "small"), btn("Sign out", async () => {
    await api("/logout", "POST", {});
    socket?.close();
    login();
  }, "small"));
  top.append(timeEl, identity);
  const content = $("div", "content");
  content.id = "content";
  main.append(top, content);
  shell2.append(aside, main);
  root.append(shell2);
  return content;
}
function heading(content, title, subtitle, buttons = []) {
  const head = $("div", "page-head"), text = $("div");
  text.append($("div", "eyebrow", "LOS ANGELES STATE ROLEPLAY"), $("h1", "", title), $("p", "", subtitle));
  head.append(text, toolbar(...buttons));
  content.append(head);
  if (me.demo) content.append($("div", "notice demo-label", "DEMO ENVIRONMENT \u2022 fictional training data. No live Discord or ER:LC actions are simulated."));
}
function hero(content, title, description, banner = "blank-blue-banner.png") {
  const h = $("section", "hero"), img = document.createElement("img");
  img.src = "/assets/branding/" + banner;
  img.alt = "LASRP official branded artwork";
  const text = $("div");
  text.append($("div", "eyebrow", "LASRP CAD"), $("h2", "", title), $("p", "", description));
  h.append(img, text);
  content.append(h);
}
async function renderPage() {
  if (!me) return;
  const content = shell();
  content.append($("p", "muted", "Loading your workspace\u2026"));
  try {
    summary = await api("/summary");
    content.replaceChildren();
    switch (section) {
      case "Dashboard":
        await home(content);
        break;
      case "Dispatch":
        await dispatch(content);
        break;
      case "Live Map":
        await mapPage(content);
        break;
      case "Mutual Aid":
        await mutualAidPage(content);
        break;
      case "Traffic Stops":
        await trafficStopsPage(content);
        break;
      case "Investigations":
        await legalPage(content);
        break;
      case "Penal Codes":
        await penalCodesPage(content);
        break;
      case "Notifications":
        await notificationsPage(content);
        break;
      case "Civilian Portal":
        await civilian(content);
        break;
      case "Applications":
        await applicationPage(content);
        break;
      case "Staff Center":
        await staffPage(content);
        break;
      case "Sessions":
        await sessionsPage(content);
        break;
      case "Admin":
        if (!me.capabilities?.websiteAdmin) throw Error("Website administrator permission required.");
        await adminPage(content);
        break;
      case "Police MDT":
        selectedAgency = has("police") ? "police" : "sheriff";
        await recordsPage(content);
        break;
      case "Fire / EMS":
        await operationalPage(content);
        break;
      case "DOT / Towing":
        await operationalPage(content);
        break;
      case "DOJ / Courts":
        await courtsPage(content);
        break;
      case "Reports":
        await recordsPage(content);
        break;
      default:
        section = "Dashboard";
        await home(content);
    }
  } catch (error) {
    content.replaceChildren(empty("This workspace is unavailable", error instanceof Error ? error.message : "Try refreshing."));
  }
}
function stat(label, value, note) {
  const s = $("div", "stat");
  s.append($("div", "label", label), $("div", "value", value), $("small", "", note));
  return s;
}
async function home(content) {
  heading(content, "Operations overview", "Situational awareness for your community.", [btn("Create call", newIncident, "primary"), ...responder() ? [btn("Go on duty", editUnit)] : []]);
  hero(content, "Connected operations. Clear decisions.", "Your shared workspace for fictional public safety, community support, and coordinated ER:LC sessions.");
  const stats = $("div", "stats"), live = summary.live;
  stats.append(stat("Server population", String(live?.currentPlayers ?? live?.players?.length ?? live?.playerCount ?? "\u2014"), live?.healthy ? "ER:LC API synchronized" : "No current live telemetry"), stat("Active incidents", String(summary.incidents ?? "\u2014"), "CAD operational records"), stat("Units on roster", String(summary.units?.length ?? 0), "Persisted duty records"), stat("API health", live?.healthy ? "Online" : "Offline", live?.synced ? "Updated " + new Date(live.synced).toLocaleTimeString() : "Awaiting ER:LC configuration"));
  content.append(stats);
  const grid = $("div", "grid"), calls = card("Incident activity");
  if (responder()) {
    const rows = await api("/incidents");
    calls.append(rows.length ? incidentTable(rows.slice(0, 5)) : empty("No active calls", "New incidents will appear here as they are created."));
  } else calls.append(empty("Your civilian workspace is ready", "Create a fictional character, register a vehicle, or submit a roleplay call."));
  const duty = card("On-duty roster");
  (summary.units ?? []).slice(0, 7).forEach((u) => {
    const row = $("div", "unit"), left = $("div", "unit-left"), text = $("div");
    text.append($("strong", "", u.callsign), $("p", "", u.agency.toUpperCase()));
    left.append($("span", "unit-code", u.callsign.slice(0, 4)), text);
    row.append(left, badge(u.status, u.status === "panic" ? "red" : ""));
    duty.append(row);
  });
  if (!summary.units?.length) duty.append(empty("No units reporting", "Responders can create a duty record from Go on duty."));
  const preferences = await api("/preferences");
  const widgets = { population: stats, calls, units: duty, activity: card("Recent incident activity"), sessions: card("Session overview") };
  widgets.activity.append(document.createTextNode(summary.incidents == null ? "See your submitted calls in Dispatch." : String(summary.incidents) + " open incidents"));
  widgets.sessions.append(document.createTextNode(summary.sessions?.length ? String(summary.sessions.length) + " recent sessions. Open Sessions for details." : "No recent sessions."));
  stats.remove();
  for (const key of preferences.dashboardWidgets) {
    if (widgets[key]) grid.append(widgets[key]);
  }
  content.append(grid);
  dashboardWidgets(grid, widgets, preferences, (p) => api("/preferences", "PUT", p), toast);
  content.append($("div", "notice", "LASRP CAD stores fictional roleplay records. Use your local emergency number for real emergencies."));
}
function newIncident() {
  form("Create roleplay incident", [{ name: "location", label: "Location / postal", max: 160 }, { name: "type", label: "Incident type", max: 80 }, { name: "priority", label: "Priority", type: "select", options: ["1", "2", "3", "4", "5"], value: "3" }, { name: "agency", label: "Responding agency", type: "select", options: ["police", "sheriff", "fire", "ems", "dot"] }, { name: "narrative", label: "Narrative \u2014 fictional roleplay only", type: "textarea", wide: true, max: 3e3 }], async (d) => {
    d.priority = Number(d.priority);
    await api("/incidents", "POST", d);
  }, "This creates a CAD call, separate from the in-game emergency call list.");
}
function incidentTable(rows) {
  return table(["Incident / source", "Location", "Priority", "Status", "Actions"], rows.map((r) => {
    const title = $("div");
    title.append($("strong", "", r.type), $("p", "muted", r.id + " \u2022 " + r.source));
    return [title, $("span", "", r.location), badge("P" + r.priority, r.priority === 1 ? "red" : ""), badge(r.status), toolbar(btn("Open", () => openIncident(r), "small"))];
  }));
}
async function dispatch(content) {
  heading(content, "Dispatch center", "Create, triage, and coordinate fictional emergency calls.", [btn("New incident", newIncident, "primary"), ...responder() ? [btn("Duty / status", editUnit), btn("Unit emergency", panicForm, "danger")] : []]);
  const rows = await api("/incidents?page=" + page);
  const box = card(responder() ? "Call stack" : "Your submitted calls");
  box.append(rows.length ? incidentTable(rows) : empty("No incidents to display", "Create a new call or return to the previous page."));
  content.append(box);
  paginate(content, rows.length);
  if (responder()) {
    const radio = card("Agency text radio");
    const list = await api("/radio?agency=" + selectedAgency);
    list.slice(0, 8).forEach((r) => {
      const row = $("div", "record");
      row.append($("p", "", `${new Date(r.createdAt).toLocaleTimeString()} \u2022 ${r.callsign}: ${r.text}`), $("span", "muted", `${r.acknowledgments ?? 0} acknowledgments`));
      if (!r.acknowledged) row.append(btn("Acknowledge", async () => {
        await api("/radio/" + r.id + "/ack", "POST", {});
        await renderPage();
      }, "small"));
      radio.append(row);
    });
    radio.append(btn("Transmit", () => form("Agency transmission", [{ name: "agency", label: "Agency", type: "select", options: availableAgencies(), value: selectedAgency }, { name: "text", label: "Message", type: "textarea", wide: true, max: 1e3 }, { name: "priority", label: "Priority broadcast", type: "checkbox", required: false }], async (d) => {
      await api("/radio", "POST", d);
    }), ""));
    content.append(radio);
  }
}
function openIncident(r) {
  const body = detail(`${r.type} \u2022 P${r.priority}`, { reference: r.id, source: r.source, location: r.location, status: r.status, narrative: r.narrative, units: r.assignments?.map((a) => a.unit.callsign).join(", ") || "Unassigned", notes: r.notes, updated: time(r.updatedAt) });
  const actions = [];
  if (responder()) {
    actions.push(btn("Update incident", () => form("Update incident", [{ name: "status", label: "Status", type: "select", options: ["pending", "dispatched", "responding", "on_scene", "closed"], value: r.status }, { name: "priority", label: "Priority", type: "select", options: ["1", "2", "3", "4", "5"], value: String(r.priority) }, { name: "note", label: "Operational note", type: "textarea", wide: true, max: 1500 }], async (d) => {
      await api("/incidents/" + r.id, "PATCH", { ...d, priority: Number(d.priority), version: r.version });
    })), btn("Create report", () => newRecord(r.id)));
    if (has("dispatcher", "supervisor")) actions.push(btn("Assign unit", () => {
      const units = summary.units ?? [];
      if (!units.length) {
        toast("No duty units are available.");
        return;
      }
      form("Assign responding unit", [{ name: "unitId", label: "Unit reference \u2014 " + units.map((u) => `${u.callsign}: ${u.id}`).join(" \u2022 "), type: "select", options: units.map((u) => u.id) }], async (d) => {
        await api("/incidents/" + r.id + "/assign", "POST", { ...d, version: r.version, remove: false });
      });
    }));
  }
  actions.push(...advancedIncidentActions(r));
  show(body, actions);
}
function advancedIncidentActions(r) {
  const actions = [];
  if (r.mergedIntoId) {
    actions.push(btn("Open surviving incident", async () => openIncident(await api("/incidents/" + r.mergedIntoId))));
    return actions;
  }
  if (r.status === "closed" || !responder()) return actions;
  if (has("dispatcher", "supervisor")) {
    actions.push(btn("Transfer agency", () => form("Transfer incident", [{ name: "agency", label: "Receiving agency", type: "select", options: availableAgencies().filter((a) => a !== r.agency) }, { name: "reason", label: "Transfer reason", type: "textarea", wide: true, max: 1e3 }], async (d) => {
      await api(`/incidents/${r.id}/transfer`, "POST", { ...d, version: r.version });
    }, "Current unit assignments are released and the receiving agency is notified. Reports remain in their original agency.")));
    actions.push(btn("Merge duplicate", async () => {
      const candidates = (await api("/incidents")).filter((c) => c.id !== r.id && c.status !== "closed" && !c.mergedIntoId);
      if (!candidates.length) {
        toast("No other open incidents are available on this page.");
        return;
      }
      form("Merge duplicate incident", [{ name: "targetId", label: "Keep this incident as the survivor", type: "select", choices: candidates.map((c) => ({ value: c.id, label: `${c.type} \u2022 ${c.location} \u2022 ${c.id}` })) }, { name: "reason", label: "Why are these the same incident?", type: "textarea", wide: true, max: 1e3 }], async (d) => {
        const target = candidates.find((c) => c.id === d.targetId);
        await api(`/incidents/${r.id}/merge`, "POST", { ...d, version: r.version, targetVersion: target.version });
      }, "This incident closes as a duplicate. Assignments, linked records and traffic-stop links move to the survivor. Original narratives and audit history remain available.");
    }));
    for (const assignment of r.assignments ?? []) actions.push(btn(`Release ${assignment.unit.callsign}`, async () => {
      await api(`/incidents/${r.id}/assign`, "POST", { unitId: assignment.unit.id, version: r.version, remove: true });
      dialog.close();
      await renderPage();
    }));
  }
  if (summary.cadPolicy?.selfDispatchEnabled) actions.push(btn("Self-dispatch", async () => {
    await api(`/incidents/${r.id}/self-dispatch`, "POST", { version: r.version });
    dialog.close();
    await renderPage();
    toast("Self-dispatch recorded.");
  }));
  return actions;
}
async function editPreferences() {
  const current = await api("/preferences");
  form("Workspace preferences", [{ name: "theme", label: "Theme", type: "select", options: ["dark", "light"], value: current.theme }, { name: "mutedKinds", label: "Muted notification types (one per line)", type: "textarea", required: false, wide: true, value: current.mutedKinds.join("\n") }, { name: "dashboardWidgets", label: "Dashboard sections in display order (one per line: population, calls, units, activity, sessions)", type: "textarea", wide: true, value: current.dashboardWidgets.join("\n") }], async (d) => {
    const saved = await api("/preferences", "PUT", { version: current.version, widgetSizes: current.widgetSizes ?? {}, theme: d.theme, mutedKinds: d.mutedKinds.split("\n").map((s) => s.trim()).filter(Boolean), dashboardWidgets: d.dashboardWidgets.split("\n").map((s) => s.trim()).filter(Boolean) });
    document.documentElement.classList.toggle("light", saved.theme === "light");
    localStorage.setItem("lasrp-theme", saved.theme);
  }, "Emergency, security and new-assignment alerts cannot be muted. Preferences are saved to your account.");
}
async function courtsPage(content) {
  heading(content, "DOJ / Courts", "Fictional court calendar, decisions and appeals.", [btn("Submit case", () => form("Submit fictional court case", [{ name: "title", label: "Case title", max: 120 }, { name: "subjectId", label: "Fictional character ID" }, { name: "reportIds", label: "Submitted / approved law-enforcement report IDs (one per line)", type: "textarea", wide: true }, { name: "narrative", label: "Case summary", type: "textarea", wide: true, max: 6e3 }], async (d) => {
    await api("/court-cases", "POST", { ...d, reportIds: d.reportIds.split("\n").map((s) => s.trim()).filter(Boolean) });
  }), "primary")]);
  const policy = await api("/court-cases/policy");
  const submit = Array.from(content.querySelectorAll("button")).find((b) => b.textContent === "Submit case");
  if (submit && !policy.actions.includes("submit")) {
    submit.disabled = true;
    submit.title = "A configured prosecutor, clerk or manager must submit cases.";
  }
  const rows = await api("/court-cases?page=" + page), box = card("Cases and hearings");
  const transitions = { submitted: ["scheduled", "dismissed"], scheduled: ["hearing", "dismissed"], hearing: ["decided", "scheduled"], decided: ["appealed"], appealed: ["scheduled", "dismissed"] };
  for (const row of rows) {
    const item = $("div", "record");
    item.append($("h3", "", row.data.title), badge(row.status), $("p", "", row.data.narrative), $("p", "muted", `${row.id} \u2022 Hearing: ${time(row.data.hearingAt)} \u2022 Verdict: ${row.data.verdict ?? "No verdict"} \u2022 Fictional fine: ${row.data.fine ?? 0}`), btn("Case history", () => show(detail(row.data.title, row)), "small"));
    if (policy.canManageAccess) item.append(btn("Sealing / case parties", () => form("Court case access", [{ name: "sealed", label: "Sealed record", type: "checkbox", required: false, value: row.sealed }, { name: "prosecutorId", label: "Assigned prosecutor Discord ID (optional)", required: false, value: row.data.prosecutorId ?? "" }, { name: "defenseId", label: "Assigned defense Discord ID (optional)", required: false, value: row.data.defenseId ?? "" }, { name: "reason", label: "Judicial authorization reason", type: "textarea", wide: true, max: 1e3 }], async (d) => {
      await api("/court-cases/" + row.id + "/access", "POST", { ...d, version: row.version });
    }), "small"));
    for (const status of (transitions[row.status] ?? []).filter((s) => policy.actions.includes(s))) item.append(btn(status.replaceAll("_", " "), () => form("Court: " + status, [{ name: "reason", label: "Reason / findings", type: "textarea", wide: true, max: 2e3 }, ...status === "scheduled" ? [{ name: "hearingAt", label: "Hearing date/time with timezone (example 2026-11-01T18:00:00-06:00)" }] : [], ...status === "decided" ? [{ name: "verdict", label: "Fictional verdict", type: "select", options: ["not_guilty", "guilty", "dismissed"] }, { name: "fine", label: "Fictional fine", type: "number", value: 0 }] : []], async (d) => {
      await api("/court-cases/" + row.id + "/transition", "POST", { ...d, version: row.version, status, ...d.hearingAt ? { hearingAt: new Date(d.hearingAt).toISOString() } : {} });
    }), "small"));
    box.append(item);
  }
  if (!rows.length) box.append(empty("No court cases", "Submit an eligible report to begin. A different DOJ member must record the final decision."));
  content.append(box);
  paginate(content, rows.length);
}
async function notificationsPage(content) {
  heading(content, "Notifications", "Your private dispatch and workflow updates.", [btn("Mark all read", async () => {
    await api("/notifications/read-all", "POST", {});
    await renderPage();
  })]);
  const rows = await api("/notifications?page=" + page), box = card("Your inbox");
  if (!rows.length) box.append(empty("You are up to date", "Assignment, incident-transfer and traffic-stop notifications appear here."));
  for (const n of rows) {
    const item = $("div", "record");
    item.append(toolbar($("h3", "", n.title), badge(n.readAt ? "Read" : "Unread", n.readAt ? "" : "green")), $("p", "", n.body), $("p", "muted", time(n.createdAt)));
    if (!n.readAt) item.append(btn("Mark read", async () => {
      await api(`/notifications/${n.id}/read`, "POST", {});
      await renderPage();
    }, "small"));
    box.append(item);
  }
  content.append(box);
  paginate(content, rows.length);
}
function penalCodeForm(code) {
  form(code ? "Edit fictional penal code" : "Create fictional penal code", [{ name: "code", label: "Roleplay code", value: code?.code, max: 20 }, { name: "title", label: "Title", value: code?.title, max: 100 }, { name: "classification", label: "Classification", type: "select", options: ["infraction", "misdemeanor", "felony"], value: code?.classification ?? "infraction" }, { name: "fine", label: "Fictional fine amount", type: "number", value: code?.fine ?? 0 }, { name: "description", label: "Definition \u2014 community roleplay policy", type: "textarea", wide: true, value: code?.description, max: 1500 }, { name: "active", label: "Available for new charges", type: "checkbox", required: false, value: code?.active ?? true }], async (d) => {
    await api("/penal-codes" + (code ? "/" + code.id : ""), code ? "PATCH" : "POST", { ...d, ...code ? { version: code.version } : {} });
  }, "These are fictional community rules. Existing citations retain their original code title and fine even when you edit this catalog.");
}
async function penalCodesPage(content) {
  heading(content, "Fictional penal code", "Community-defined offenses and citation amounts.", has("management") ? [btn("New penal code", () => penalCodeForm(), "primary")] : []);
  const rows = await api("/penal-codes" + (has("management") ? "?all=true" : "")), box = card("Penal-code catalog");
  if (!rows.length) box.append(empty("No codes configured", "Management must add fictional codes before citation or arrest dispositions can be recorded."));
  box.append(table(["Code", "Definition", "Class", "Fictional fine", "Status / actions"], rows.map((c) => {
    const definition = $("div");
    definition.append($("strong", "", c.title), $("p", "muted", c.description));
    return [$("span", "", c.code), definition, badge(c.classification), $("span", "", String(c.fine)), toolbar(badge(c.active ? "Active" : "Inactive"), ...has("management") ? [btn("Edit", () => penalCodeForm(c), "small")] : [])];
  })));
  content.append(box);
}
function newTrafficStop() {
  const agencies = availableAgencies().filter((a) => ["police", "sheriff"].includes(a));
  form("Begin traffic stop", [{ name: "agency", label: "Your duty agency", type: "select", options: agencies, value: agencies.includes(selectedAgency) ? selectedAgency : agencies[0] }, { name: "plate", label: "Vehicle plate", max: 10 }, { name: "location", label: "Location / postal", max: 160 }, { name: "driverId", label: "Fictional driver character ID (optional)", required: false, max: 100 }, { name: "passengers", label: "Fictional passenger character IDs, one per line", type: "textarea", wide: true, required: false }, { name: "incidentId", label: "Linked incident ID (optional)", required: false, max: 100 }, { name: "narrative", label: "Reason for stop / observed conduct", type: "textarea", wide: true, max: 3e3 }], async (d) => {
    await api("/traffic-stops", "POST", { agency: d.agency, plate: d.plate, location: d.location, narrative: d.narrative, passengers: d.passengers.split("\n").map((v) => v.trim()).filter(Boolean), ...d.driverId ? { driverId: d.driverId } : {}, ...d.incidentId ? { incidentId: d.incidentId } : {} });
  }, "Use fictional character IDs from person lookup. Your duty agency and callsign are checked by the server.");
}
async function trafficStopsPage(content) {
  const choices = availableAgencies().filter((a) => ["police", "sheriff"].includes(a));
  if (!choices.includes(selectedAgency)) selectedAgency = choices[0] ?? "police";
  heading(content, "Traffic stops", "Document the stop, coordinate assistance, and record the disposition.", [btn("New traffic stop", newTrafficStop, "primary"), btn("Person / plate lookup", lookup)]);
  const select = document.createElement("select");
  choices.forEach((a) => select.add(new Option(a.toUpperCase(), a)));
  select.value = selectedAgency;
  select.onchange = () => {
    selectedAgency = select.value;
    page = 0;
    void renderPage();
  };
  content.append(select);
  const rows = await api(`/traffic-stops?agency=${selectedAgency}&page=${page}`), box = card("Stop register");
  if (!rows.length) box.append(empty("No traffic stops recorded", "Begin a stop while on duty to create a structured record."));
  else box.append(table(["Vehicle / reference", "Officer / location", "Status", "Disposition", "Actions"], rows.map((s) => {
    const title = $("div");
    title.append($("strong", "", s.plate), $("p", "muted", s.id));
    const officer = $("div");
    officer.append($("strong", "", s.callsign), $("p", "muted", s.location));
    return [title, officer, badge(s.status), badge(s.disposition), btn("Open stop", () => openTrafficStop(s), "small")];
  })));
  content.append(box);
  paginate(content, rows.length);
}
function openTrafficStop(s) {
  const body = detail(`Traffic stop \u2022 ${s.plate}`, { reference: s.id, officer: s.callsign, agency: s.agency, location: s.location, driver: s.driverId ?? "Not identified", passengers: s.passengers, incident: s.incidentId ?? "None", status: s.status, disposition: s.disposition, backup: s.backupRequested ? "Requested" : "Not requested", tow: s.towRequested ? "Requested" : "Not requested", narrative: s.narrative, ...s.report ? { report: s.report.id, fine: s.report.data.fine, charges: s.report.charges.map((c) => `${c.codeSnapshot}: ${c.titleSnapshot} \xD7 ${c.count} (${c.fine} each)`) } : {} });
  const actions = [];
  if (s.status === "active") {
    actions.push(btn("Update / request assistance", () => form("Traffic stop update", [{ name: "location", label: "Location", value: s.location, max: 160 }, { name: "narrative", label: "Current narrative", type: "textarea", wide: true, value: s.narrative, max: 3e3 }, { name: "backupRequested", label: "Request backup", type: "checkbox", required: false, value: s.backupRequested }, { name: "towRequested", label: "Request towing", type: "checkbox", required: false, value: s.towRequested }], async (d) => {
      await api(`/traffic-stops/${s.id}`, "PATCH", { ...d, version: s.version });
    })));
    actions.push(btn("Record disposition", async () => {
      const codes = await api("/penal-codes");
      form("Conclude traffic stop", [{ name: "disposition", label: "Disposition", type: "select", options: ["no_action", "warning", "citation", "arrest"] }, { name: "charges", label: "Applicable fictional codes (Ctrl/Cmd to select multiple; none for warning/no action)", type: "multiselect", choices: codes.map((c) => ({ value: c.id, label: `${c.code} \u2014 ${c.title} (${c.fine})` })), required: false, wide: true }, { name: "narrative", label: "Final report narrative", type: "textarea", wide: true, value: s.narrative, max: 3e3 }], async (d) => {
        await api(`/traffic-stops/${s.id}/close`, "POST", { ...d, version: s.version, charges: d.charges.map((id) => ({ penalCodeId: id, count: 1 })) });
      }, "Citation/arrest requires a configured code. An arrest requires a linked fictional driver. Recording an arrest never records a conviction.");
    }));
  }
  if (s.status === "active") actions.push(btn("Create tow request", () => newOperationalCase("tow", { plate: s.plate, location: s.location, trafficStopId: s.id, ...s.incidentId ? { incidentId: s.incidentId } : {} })));
  if (s.report) actions.push(btn("Open linked report", () => openRecord(s.report)));
  show(body, actions);
}
function operationalFields(kind, values = {}, updating = false) {
  const common = [{ name: "location", label: "Location / postal", value: values.location, max: 150 }, { name: "summary", label: "Fictional incident summary", type: "textarea", wide: true, value: values.summary, max: 3e3 }];
  if (kind === "fire") return [...common, { name: "station", label: "Station", value: values.station, max: 150 }, { name: "apparatus", label: "Apparatus", value: values.apparatus, max: 150 }, { name: "commander", label: "Incident command callsign", value: values.commander, max: 150 }, { name: "staging", label: "Staging location", value: values.staging, max: 150 }, { name: "hazard", label: "Hazard category", type: "select", options: ["low", "moderate", "high"], value: values.hazard ?? "low" }, { name: "notes", label: "Operational notes", type: "textarea", wide: true, required: false, value: values.notes ?? "", max: 2e3 }];
  if (kind === "ems") return [...common, { name: "patientAlias", label: "Fictional patient alias \u2014 no real medical information", value: values.patientAlias, max: 150 }, ...!updating ? [{ name: "characterId", label: "Fictional character ID (optional)", required: false, max: 100 }] : [], ...updating ? [{ name: "hospital", label: "Fictional receiving hospital", type: "select", choices: [{ value: "", label: "Not transporting" }, ...(summary.operationalPolicy?.hospitals ?? []).map((h) => ({ value: h, label: h }))], value: values.hospital ?? "" }, { name: "transportNotes", label: "Fictional transport notes", type: "textarea", wide: true, required: false, value: values.transportNotes ?? "", max: 1500 }] : [], { name: "notes", label: "Minimal fictional response notes", type: "textarea", wide: true, required: false, value: values.notes ?? "", max: 2e3 }];
  return [...common, ...!updating ? [{ name: "plate", label: "Vehicle plate", value: values.plate, max: 10 }, { name: "vehicleId", label: "Fictional DMV vehicle ID (optional; enables owner release requests)", value: values.vehicleId ?? "", required: false, max: 100 }] : [], ...updating ? [{ name: "impoundLot", label: "Impound lot", value: values.impoundLot ?? "", required: false, max: 150 }, { name: "inventoryNotes", label: "Impound inventory", type: "textarea", wide: true, required: false, value: values.inventoryNotes ?? "", max: 1500 }, { name: "releaseReason", label: "Release authorization reason", type: "textarea", wide: true, required: false, value: values.releaseReason ?? "", max: 1e3 }] : [], { name: "notes", label: "Private DOT notes", type: "textarea", wide: true, required: false, value: values.notes ?? "", max: 2e3 }];
}
function newOperationalCase(kind, prefill = {}) {
  form(`Create ${kind.toUpperCase()} case`, operationalFields(kind, prefill), async (fields) => {
    const { characterId, vehicleId, ...data } = fields;
    await api("/operational-cases", "POST", { kind, ...prefill.incidentId ? { incidentId: prefill.incidentId } : {}, data: { ...data, ...characterId ? { characterId } : {}, ...vehicleId ? { vehicleId } : {}, ...prefill.trafficStopId ? { trafficStopId: prefill.trafficStopId } : {} } });
  }, kind === "ems" ? "Use invented roleplay details only. Never enter real patient information." : "This is a fictional roleplay workflow, separate from real ER:LC vehicle or apparatus controls.");
}
async function operationalPage(content) {
  const kinds = section === "DOT / Towing" ? ["tow"] : ["fire", "ems"].filter((k) => has(k));
  if (!kinds.includes(operationalKind)) operationalKind = kinds[0] ?? "fire";
  const policy = await api("/operational-policy");
  summary.operationalPolicy = policy;
  heading(content, section, operationalKind === "tow" ? "Tow coordination, impound inventory, and authorized release." : "Agency-specific response, command, and fictional transport workflows.", [btn("Stations / apparatus", () => resourcePanel(operationalKind === "tow" ? "dot" : operationalKind)), btn("New " + operationalKind.toUpperCase() + " case", () => newOperationalCase(operationalKind), "primary"), btn("Agency reports", () => {
    selectedAgency = operationalKind === "tow" ? "dot" : operationalKind;
    selectedKind = "all";
    go("Reports");
  })]);
  if (kinds.length > 1) content.append(toolbar(...kinds.map((k) => btn(k.toUpperCase(), () => {
    operationalKind = k;
    page = 0;
    void renderPage();
  }, k === operationalKind ? "primary" : ""))));
  const rows = await api(`/operational-cases?kind=${operationalKind}&page=${page}`), box = card("Active and historical cases");
  if (!rows.length) box.append(empty("No cases recorded", "Create an agency case, claim it while on duty, and advance it through the permitted stages."));
  for (const row of rows) {
    const item = $("div", "record");
    item.append(toolbar($("h3", "", `${row.kind.toUpperCase()} \u2022 ${row.data.location}`), badge(row.status)), $("p", "muted", `${row.id} \u2022 ${row.assigneeId ? "Assigned to " + row.assigneeId : "Unclaimed"}`), $("p", "", row.data.summary), btn("Open case", () => openOperationalCase(row, policy), "small"));
    box.append(item);
  }
  content.append(box);
  paginate(content, rows.length);
}
function openOperationalCase(row, policy) {
  const body = detail(`${row.kind.toUpperCase()} | ${row.id}`, { status: row.status, assigned: row.assigneeId ?? "Unclaimed", ...row.data, report: row.reportId ?? "Created on completion" }), actions = [];
  const transitions = policy.transitions[row.kind]?.[row.status] ?? [];
  if (transitions.length) {
    if (!row.assigneeId) actions.push(btn("Claim case", async () => {
      await api(`/operational-cases/${row.id}/claim`, "POST", { version: row.version });
      dialog.close();
      await renderPage();
    }));
    if (row.assigneeId === me.user.id || has("supervisor")) actions.push(btn("Advance workflow", () => form("Update agency case", [{ name: "nextStatus", label: "Next stage", type: "select", options: transitions }, ...operationalFields(row.kind, row.data, true)], async (fields) => {
      const { nextStatus, ...data } = fields;
      await api(`/operational-cases/${row.id}`, "PATCH", { version: row.version, nextStatus, data });
    }, "Stages are enforced on the server. Transport requires a configured fictional hospital; impound requires inventory; release requires an authorization reason.")));
  }
  if (row.kind === "ems") actions.push(btn("Patients / transport", () => patientPanel(row)));
  if (row.report) actions.push(btn("Open completion report", () => openRecord(row.report)));
  show(body, actions);
}
async function appendImpounds(content) {
  const rows = await api("/my-impounds");
  if (!rows.length) return;
  const box = card("Your fictional impounded vehicles");
  for (const row of rows) {
    const item = $("div", "record");
    item.append($("h3", "", row.plate), $("p", "", `Impound lot: ${row.impoundLot}`), badge(row.releaseRequested ? "Release review requested" : "Impounded"));
    if (!row.releaseRequested) item.append(btn("Request release review", async () => {
      await api(`/operational-cases/${row.id}/request-release`, "POST", { version: row.version });
      await renderPage();
      toast("Release review requested. DOT must authorize release.");
    }));
    box.append(item);
  }
  content.append(box);
}
function availableAgencies() {
  return ["police", "sheriff", "fire", "ems", "dot", "dispatch", ...me.features.courts ? ["doj"] : []].filter((a) => has("dispatcher", "supervisor", a === "dispatch" ? "dispatcher" : a));
}
function editUnit() {
  const current = summary.units?.find((u) => u.userId === me.user.id);
  form("Duty & unit status", [{ name: "callsign", label: "Callsign", value: current?.callsign, max: 30 }, { name: "agency", label: "Agency", type: "select", options: availableAgencies(), value: current?.agency ?? selectedAgency }, { name: "status", label: "Status", type: "select", options: ["available", "busy", "en_route", "on_scene", "traffic_stop", "transport", "out_of_service", "panic"], value: current?.status ?? "available" }, { name: "location", label: "Reported location (manual)", value: current?.location ?? "", required: false, max: 150 }], async (d) => {
    await api("/unit", "PUT", { ...d, ...current ? { version: current.version } : {} });
  });
}
async function mapPage(content) {
  await renderLiveMap(content, { api, has, form, show, toast, openIncident, userId: me.user.id });
}
async function civilian(content) {
  heading(content, "Civilian portal", "Manage your fictional characters and DMV registrations.", [btn("New character", () => form("Create fictional character", [{ name: "name", label: "Fictional character name", max: 80 }, { name: "occupation", label: "Fictional occupation", required: false, max: 80 }, { name: "description", label: "Fictional description \u2014 no real personal data", type: "textarea", wide: true, required: false, max: 500 }], async (d) => {
    await api("/characters", "POST", { name: d.name, demographics: { occupation: d.occupation, description: d.description }, licenses: [] });
  }), "primary")]);
  const [characters, vehicles] = await Promise.all([api("/characters"), api("/vehicles")]);
  const chars = card("Your characters");
  characters.forEach((c) => {
    const row = $("div", "record");
    row.append($("h3", "", c.name), $("p", "muted", c.id), $("p", "", c.demographics?.description ?? "No description."), btn("Register vehicle", () => form("DMV registration", [{ name: "plate", label: "Fictional plate", max: 10 }, { name: "make", label: "Make", max: 50 }, { name: "model", label: "Model", max: 60 }, { name: "color", label: "Color", max: 40 }], async (d) => {
      await api("/vehicles", "POST", { ...d, characterId: c.id });
    }), "small"));
    chars.append(row);
  });
  if (!characters.length) chars.append(empty("Start your story", "Create a fictional character to register vehicles."));
  content.append(chars);
  const veh = card("Vehicle registrations");
  vehicles.forEach((v) => {
    const row = $("div", "record");
    row.append($("h3", "", `${v.plate} \u2022 ${v.make} ${v.model}`), $("p", "", `${v.color} \u2022 ${v.stolen ? "Reported stolen" : "Registered"} \u2022 Fictional DMV record`), toolbar(btn(v.stolen ? "Clear stolen flag" : "Report stolen", async () => {
      await api("/vehicles/" + v.id, "PATCH", { version: v.version, stolen: !v.stolen });
      await renderPage();
    }, "small"), btn("Transfer ownership", () => form("Transfer vehicle", [{ name: "transferTo", label: "Recipient Discord user ID" }, { name: "characterId", label: "Recipient fictional character ID" }], async (d) => {
      await api("/vehicles/" + v.id, "PATCH", { ...d, version: v.version });
    }), "small")));
    veh.append(row);
  });
  if (!vehicles.length) veh.append(empty("No registered vehicles", "Choose Register vehicle from one of your characters."));
  content.append(veh);
  await appendImpounds(content);
  await robloxPanel(content);
  await registrationsPanel(content);
}
function reportKinds() {
  return selectedAgency === "ems" ? ["ems_report", "incident_report", "evidence", "crash"] : selectedAgency === "fire" ? ["fire_incident", "ems_report", "incident_report", "evidence", "crash"] : selectedAgency === "dot" ? ["tow_request", "incident_report", "highway_assistance", "crash"] : selectedAgency === "doj" ? ["incident_report", "evidence"] : ["incident_report", "traffic_stop", "citation", "arrest", "investigation", "evidence", "crash", "use_of_force", "witness_statement", "search_seizure"];
}
function newRecord(incidentId, kind) {
  if (!kind) {
    const body = $("div"), select = document.createElement("select");
    body.append($("h2", "", "Choose report type"));
    for (const value of reportKinds()) select.add(new Option(value.replaceAll("_", " "), value));
    select.value = reportKinds().includes(selectedKind) ? selectedKind : reportKinds()[0];
    body.append(select);
    show(body, [btn("Continue", () => newRecord(incidentId, select.value))]);
    return;
  }
  const detailFields = { crash: [{ name: "vehicles", label: "Fictional involved vehicles / plates", type: "textarea", wide: true, max: 1e3 }, { name: "injuries", label: "Minimal fictional injury summary", type: "textarea", required: false, max: 1e3 }], use_of_force: [{ name: "basis", label: "Fictional circumstances and justification", type: "textarea", wide: true, max: 1e3 }, { name: "forceUsed", label: "Fictional force used and outcome", type: "textarea", wide: true, max: 1e3 }], witness_statement: [{ name: "alias", label: "Fictional witness alias", max: 80 }, { name: "statement", label: "Recorded fictional statement", type: "textarea", wide: true, max: 3e3 }], search_seizure: [{ name: "basis", label: "Fictional authority / consent / warrant reference", type: "textarea", wide: true, max: 1e3 }, { name: "items", label: "Fictional seized property inventory", type: "textarea", wide: true, max: 1500 }], highway_assistance: [{ name: "service", label: "Assistance type", type: "select", options: ["disabled_vehicle", "debris", "road_closure", "traffic_control"] }, { name: "outcome", label: "Action and outcome", type: "textarea", wide: true, max: 1e3 }] };
  const extras = detailFields[kind] ?? [];
  form("Create " + kind.replaceAll("_", " "), [{ name: "agency", label: "Agency", type: "select", options: availableAgencies(), value: selectedAgency }, { name: "title", label: "Record title", max: 150 }, { name: "subjectId", label: "Fictional character reference", required: false, max: 100 }, { name: "plate", label: "Plate (optional)", required: false, max: 10 }, { name: "location", label: "Location (optional)", required: false, max: 150 }, { name: "disposition", label: "Legal status", type: "select", options: ["accusation", "warning", "citation", "arrest", "none"] }, { name: "narrative", label: "Fictional report narrative", type: "textarea", wide: true, max: 6e3 }, ...extras], async (d) => {
    const { agency, subjectId, ...data } = d;
    let details;
    if (extras.length) {
      details = { type: kind };
      for (const field of extras) {
        details[field.name] = data[field.name];
        delete data[field.name];
      }
    }
    await api("/records", "POST", { kind, agency, ...subjectId ? { subjectId } : {}, ...incidentId ? { incidentId } : {}, data: { ...data, ...details ? { details } : {}, evidenceUrls: [] } });
  });
}
async function recordsPage(content) {
  heading(content, section, "Agency records, investigations, and controlled report review.", [btn("New record", () => newRecord(), "primary"), ...has("supervisor") ? [btn("Bulk export", bulkExport)] : [], ...has("police", "sheriff", "dispatcher") ? [btn("Person / plate lookup", lookup)] : [], ...responder() ? [btn("Unit status", editUnit)] : []]);
  const filters = toolbar();
  const agencies = document.createElement("select");
  availableAgencies().forEach((a) => agencies.add(new Option(a.toUpperCase(), a)));
  agencies.value = selectedAgency;
  agencies.onchange = () => {
    selectedAgency = agencies.value;
    page = 0;
    void renderPage();
  };
  const kinds = document.createElement("select");
  ["all", ...reportKinds()].forEach((k) => kinds.add(new Option(k.replaceAll("_", " "), k)));
  kinds.value = selectedKind;
  kinds.onchange = () => {
    selectedKind = kinds.value;
    page = 0;
    void renderPage();
  };
  filters.append(agencies, kinds);
  content.append(filters);
  const rows = await api(`/records?agency=${selectedAgency}&page=${page}${selectedKind && selectedKind !== "all" ? "&kind=" + selectedKind : ""}`), box = card("Record register");
  if (!rows.length) box.append(empty("No records found", "Create an agency record or adjust your filters."));
  rows.forEach((r) => {
    const item = $("div", "record");
    item.append(toolbar($("h3", "", r.data.title), badge(r.status)), $("p", "muted", `${r.kind.replaceAll("_", " ")} \u2022 ${r.id} \u2022 v${r.version}`), $("p", "", r.data.narrative.slice(0, 300)), btn("Open record", () => openRecord(r), "small"));
    box.append(item);
  });
  content.append(box);
  paginate(content, rows.length);
}
function openRecord(r) {
  const body = detail(r.data.title, { reference: r.id, type: r.kind, agency: r.agency, status: r.status, subject: r.subjectId ?? "\u2014", incident: r.incidentId ?? "\u2014", ...r.data, sealed: r.sealed, version: r.version });
  show(body, [btn("Download PDF", () => downloadCad("/records/" + r.id + "/pdf", "LASRP-" + r.id + ".pdf")), btn("Revise / review", () => form("Update record", [{ name: "status", label: "Status", type: "select", options: ["draft", "submitted", ...has("supervisor", "doj") ? ["approved", "denied", "issued", "cancelled"] : [], "closed"], value: r.status }, { name: "title", label: "Title", value: r.data.title, max: 150 }, { name: "narrative", label: "Narrative", type: "textarea", wide: true, value: r.data.narrative, max: 6e3 }, ...has("supervisor", "doj") ? [{ name: "sealed", label: "Seal record", type: "checkbox", value: r.sealed, required: false }] : []], async (d) => {
    const { status, sealed, ...fields } = d;
    await api("/records/" + r.id, "PATCH", { version: r.version, status, ...sealed !== void 0 ? { sealed } : {}, data: { ...Object.fromEntries(Object.entries(r.data).filter(([key]) => !["trafficStopId", "operationalCaseId"].includes(key))), ...fields } });
  })), btn("Evidence files", () => evidencePanel(r)), ...r.data.details ? [btn("Revise report details", () => editReportDetails(r))] : [], btn("History / custody", async () => {
    const history = await api("/record-history/" + r.id);
    show(detail("Immutable record history", { history }));
  })]);
}
function lookup() {
  form("Person / plate / case lookup", [{ name: "q", label: "Fictional character, plate, or exact record ID", max: 80 }], async (d) => {
    const result = await api("/lookup?q=" + encodeURIComponent(d.q));
    setTimeout(() => {
      show(detail("Lookup results \u2014 fictional records only", result));
      if (result.alerts?.length) toast(result.alerts.length + " active warrant / BOLO matches. Review the alert records.");
    }, 50);
  });
}
async function evidencePanel(record) {
  const result = await api(`/records/${record.id}/evidence`), body = $("div");
  body.append($("h2", "", `Private evidence \u2022 ${record.data.title}`), $("p", "muted", "Original files are encrypted on disk. Downloads verify the stored SHA-256 fingerprint and record a custody event."));
  body.append($("p", "notice", result.scanMode === "required" ? "Uploads require a clean ClamAV scan before storage." : "Malware scanning is disabled in this local development environment."));
  for (const evidence of result.files) {
    const row = $("div", "record"), link = document.createElement("a");
    link.href = `/api/evidence/${evidence.id}/download`;
    link.textContent = "Download original";
    const custody = btn("Custody log", async () => {
      const events = await api(`/evidence/${evidence.id}/custody`);
      show(detail("Evidence custody", { file: evidence.originalName, events }));
    });
    row.append($("h3", "", evidence.originalName), $("p", "muted", `${evidence.mimeType} \u2022 ${evidence.byteCount} bytes \u2022 ${time(evidence.createdAt)}`), $("p", "muted", `SHA-256: ${evidence.checksum}`), toolbar(link, custody, btn("Physical handoff", () => physicalCustody(evidence))));
    body.append(row);
  }
  if (!result.files.length) body.append(empty("No files uploaded", "Upload a supported file to attach it to this report."));
  if ((record.ownerId === me.user.id || has("supervisor")) && result.uploadsEnabled) {
    const label = $("label", "", "PNG, JPEG, PDF or UTF-8 TXT \u2022 maximum 8 MiB"), file = document.createElement("input");
    file.type = "file";
    file.accept = ".png,.jpg,.jpeg,.pdf,.txt";
    label.append(file);
    const upload = btn("Upload evidence", async () => {
      const selected = file.files?.[0];
      if (!selected) {
        toast("Choose a file first.");
        return;
      }
      if (selected.size > 8 * 1024 * 1024) {
        toast("Choose a file no larger than 8 MiB.");
        return;
      }
      upload.disabled = true;
      try {
        const response = await fetch(`/api/records/${record.id}/evidence`, { method: "POST", headers: { "Content-Type": "application/octet-stream", "X-CSRF-Token": me.csrf, "X-Record-Version": String(result.recordVersion), "X-File-Name": encodeURIComponent(selected.name) }, body: selected });
        const data = await response.json();
        if (!response.ok) throw Error(data.error ?? "Evidence upload failed");
        await evidencePanel(record);
        toast("Evidence encrypted and saved.");
      } finally {
        upload.disabled = false;
      }
    }, "primary");
    body.append(label, upload);
  } else if (!result.uploadsEnabled) body.append($("div", "notice", "Evidence uploads require the private FILE_STORAGE_SECRET. Management can run npm run setup:env to generate a missing key. Keep it with the encrypted evidence backups."));
  show(body);
}
async function applicationPage(content) {
  heading(content, "Staff applications", "Start and complete your application in Discord DMs.");
  content.append(btn("Open applications channel", () => window.open("https://discord.com/channels/1529507818452029650/1557893259840458792", "_blank", "noopener"), "primary"));
  hero(content, "Serve the LASRP community.", "Thoughtful decisions start with clear standards. Your application is saved after every response.", "applications-banner.png");
  const rows = await api("/applications");
  if (!rows.length) {
    content.append(empty("No applications yet", "Begin an application when recruitment is open."));
    return;
  }
  rows.forEach((a) => {
    const box = card(`LASRP-APP-${String(a.number).padStart(6, "0")}`);
    box.append(badge(a.status), $("p", "muted", `Applicant: ${a.applicantId} \u2022 Updated ${time(a.updatedAt)}`));
    if (a.applicantId === me.user.id && ["intro", "draft", "paused"].includes(a.status)) {
      box.append($("p", "", "Continue answering the current question in your Discord DMs. Answers are final once submitted."));
    } else if (has("reviewer") && a.applicantId !== me.user.id) {
      box.append(btn("Review full answers", () => show(detail("Private application review", Object.fromEntries(a.questions.map((q, index) => [q, a.answers[index] ?? "No answer"]))))), btn("Review action", () => form("Application decision", [{ name: "action", label: "Review action", type: "select", options: [...has("management") ? ["accept"] : [], "deny", "interview", "more_info", "note"] }, { name: "reason", label: "Applicant response / private note", type: "textarea", wide: true, max: 1500 }], async (d) => {
        await api(`/applications/${a.id}/review`, "POST", { ...d, version: a.version });
      })));
    }
    if (a.decisionReason) box.append($("p", "", a.decisionReason));
    content.append(box);
  });
}
async function staffPage(content) {
  heading(content, "Staff center", "Shared community operations, records, and duty activity.");
  const data = await api("/staff");
  for (const [title, rows] of Object.entries(data)) {
    const box = card(title.replaceAll("_", " ")), entries = Array.isArray(rows) ? rows : Object.values(rows ?? {});
    if (!entries.length) box.append(empty("No " + title + " records", "New authorized activity will appear here."));
    else entries.slice(-15).reverse().forEach((row) => {
      const r = $("div", "record");
      r.append($("h3", "", row.id ?? row.kind ?? row.user ?? "Staff record"), $("p", "", JSON.stringify(row, null, 2).slice(0, 700)));
      box.append(r);
    });
    content.append(box);
  }
}
function basicSessionsPage(content) {
  heading(content, "Community sessions", "Session hosts, attendance, and operational history.");
  hero(content, "Realistic roleplay. Coordinated sessions.", "Authorized hosts start and end official sessions through Discord. Live panels update in place.", "sessions-banner.png");
  const rows = summary.sessions ?? [];
  const box = card("Recent official sessions");
  if (!rows.length) box.append(empty("No official sessions recorded", "A session host can use /ssu in Discord."));
  else box.append(table(["Session", "Host", "Started", "Duration / status", "Peak"], rows.slice().reverse().map((s) => [$("span", "", s.id), $("span", "", s.host), $("span", "", time(s.start)), badge(s.end ? `${Math.floor((s.end - s.start) / 6e4)} minutes` : "Active", s.end ? "" : "green"), $("span", "", String(s.peak))])));
  content.append(box);
}
async function adminPage(content) {
  heading(content, "Administration", "Centralized configuration, traceability, and operational controls.", [btn("Open panel studio", () => window.open("/admin", "_blank", "noopener")), btn("Recruitment settings", async () => {
    const current = await api("/application-settings");
    form("Staff application settings", [{ name: "open", label: "Recruitment open", type: "checkbox", required: false, value: current.open }, { name: "requirements", label: "Minimum requirements (configure before opening)", type: "textarea", wide: true, value: current.requirements, max: 600 }, { name: "cooldownHours", label: "Reapply cooldown in hours", type: "number", value: current.cooldownHours }, { name: "questions", label: "Questions \u2014 one per line", type: "textarea", wide: true, value: current.questions.join("\n") }], async (d) => {
      await api("/application-settings", "PUT", { ...d, questions: d.questions.split("\n").map((q) => q.trim()).filter(Boolean) });
    });
  })]);
  await registrationReviews(content);
  const config = await api("/config");
  const settings = card("Configuration");
  settings.append($("p", "", "Discord IDs and security-critical owner settings live in config/ids.ts. Persisted channel bindings can be updated with /setup wizard. The studio handles template versions and announcement scheduling."), btn("View active configuration", () => show(detail("Active nonsecret settings", config))));
  content.append(settings);
  const logs = await api("/audit");
  const auditCard = card("Recent immutable audit events");
  auditCard.append(logs.length ? table(["Action", "Actor", "Entity", "Time"], logs.map((l) => [$("span", "", l.action), $("span", "", l.actorId), $("span", "", l.entityId), $("span", "", time(l.createdAt))])) : empty("No audit events", "Changes appear here after your first action."));
  content.append(auditCard);
}
function paginate(content, count) {
  const p = $("div", "pagination");
  if (page > 0) p.append(btn("Previous", () => {
    page--;
    void renderPage();
  }));
  p.append($("span", "muted", "Page " + (page + 1)));
  if (count === 25) p.append(btn("Next", () => {
    page++;
    void renderPage();
  }));
  content.append(p);
}
function connect() {
  socket?.close();
  socket = new WebSocket((location.protocol === "https:" ? "wss:" : "ws:") + "//" + location.host + "/live");
  socket.onmessage = (e) => {
    const message = JSON.parse(e.data);
    if (message.type === "refresh" && !dialog.open) {
      clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => void renderPage(), 500);
    }
  };
  socket.onclose = (e) => {
    if (e.code === 1008 || e.code === 1011) {
      void showAdmission();
      return;
    }
    if (me) setTimeout(connect, 5e3);
  };
}
async function boot() {
  try {
    me = await api("/me");
    const admission = await api("/cad-access");
    if (!admission.admitted) {
      await showAdmission(admission);
      return;
    }
    const selected = decodeURIComponent(location.hash.slice(1));
    if (selected) section = selected;
    const prefs = await api("/preferences");
    document.documentElement.classList.toggle("light", prefs.theme === "light");
    connect();
    await renderPage();
  } catch {
    login();
  }
}
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && dialog.open) dialog.close();
  if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName) && me && has("police", "sheriff", "dispatcher")) {
    event.preventDefault();
    lookup();
  }
});
setInterval(() => {
  if (me && responder()) void api("/unit/heartbeat", "POST", {}).catch(() => {
  });
}, 6e4);
void boot();
async function showAdmission(known) {
  socket?.close();
  socket = void 0;
  summary = {};
  me = void 0;
  try {
    const state = known ?? await api("/cad-access");
    root.replaceChildren();
    const body = $("main", "login-form");
    body.append($("h1", "", "CAD approval required"), $("p", "", `Current status: ${String(state.status ?? "unavailable").replaceAll("_", " ")}. Discord sign-in alone does not grant CAD admission.`));
    const link = $("a", "button", "View CAD application and status");
    link.href = state.applicationUrl;
    body.append(link);
    root.append(body);
  } catch {
    login();
  }
}
