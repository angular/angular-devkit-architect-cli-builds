#!/usr/bin/env node
"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const architect_1 = require("@angular-devkit/architect");
const node_1 = require("@angular-devkit/architect/node");
const core_1 = require("@angular-devkit/core");
const node_2 = require("@angular-devkit/core/node");
const ansiColors = __importStar(require("ansi-colors"));
const fs_1 = require("fs");
const path = __importStar(require("path"));
const operators_1 = require("rxjs/operators");
const yargs_parser_1 = __importStar(require("yargs-parser"));
const progress_1 = require("../src/progress");
function findUp(names, from) {
    if (!Array.isArray(names)) {
        names = [names];
    }
    const root = path.parse(from).root;
    let currentDir = from;
    while (currentDir && currentDir !== root) {
        for (const name of names) {
            const p = path.join(currentDir, name);
            if ((0, fs_1.existsSync)(p)) {
                return p;
            }
        }
        currentDir = path.dirname(currentDir);
    }
    return null;
}
/**
 * Show usage of the CLI tool, and exit the process.
 */
function usage(logger, exitCode = 0) {
    logger.info(core_1.tags.stripIndent `
    architect [project][:target][:configuration] [options, ...]

    Run a project target.
    If project/target/configuration are not specified, the workspace defaults will be used.

    Options:
        --help              Show available options for project target.
                            Shows this message instead when ran without the run argument.


    Any additional option is passed the target, overriding existing options.
  `);
    return process.exit(exitCode);
}
function _targetStringFromTarget({ project, target, configuration }) {
    return `${project}:${target}${configuration !== undefined ? ':' + configuration : ''}`;
}
// Create a separate instance to prevent unintended global changes to the color configuration
// Create function is not defined in the typings. See: https://github.com/doowb/ansi-colors/pull/44
const colors = ansiColors.create();
async function _executeTarget(parentLogger, workspace, root, argv, registry) {
    const architectHost = new node_1.WorkspaceNodeModulesArchitectHost(workspace, root);
    const architect = new architect_1.Architect(architectHost, registry);
    // Split a target into its parts.
    const { _: [targetStr = ''], help, ...options } = argv;
    const [project, target, configuration] = targetStr.toString().split(':');
    const targetSpec = { project, target, configuration };
    const logger = new core_1.logging.Logger('jobs');
    const logs = [];
    logger.subscribe((entry) => logs.push({ ...entry, message: `${entry.name}: ` + entry.message }));
    // Camelize options as yargs will return the object in kebab-case when camel casing is disabled.
    const camelCasedOptions = {};
    for (const [key, value] of Object.entries(options)) {
        if (/[A-Z]/.test(key)) {
            throw new Error(`Unknown argument ${key}. Did you mean ${(0, yargs_parser_1.decamelize)(key)}?`);
        }
        camelCasedOptions[(0, yargs_parser_1.camelCase)(key)] = value;
    }
    const run = await architect.scheduleTarget(targetSpec, camelCasedOptions, { logger });
    const bars = new progress_1.MultiProgressBar(':name :bar (:current/:total) :status');
    run.progress.subscribe((update) => {
        const data = bars.get(update.id) || {
            id: update.id,
            builder: update.builder,
            target: update.target,
            status: update.status || '',
            name: ((update.target ? _targetStringFromTarget(update.target) : update.builder.name) +
                ' '.repeat(80)).substring(0, 40),
        };
        if (update.status !== undefined) {
            data.status = update.status;
        }
        switch (update.state) {
            case architect_1.BuilderProgressState.Error:
                data.status = 'Error: ' + update.error;
                bars.update(update.id, data);
                break;
            case architect_1.BuilderProgressState.Stopped:
                data.status = 'Done.';
                bars.complete(update.id);
                bars.update(update.id, data, update.total, update.total);
                break;
            case architect_1.BuilderProgressState.Waiting:
                bars.update(update.id, data);
                break;
            case architect_1.BuilderProgressState.Running:
                bars.update(update.id, data, update.current, update.total);
                break;
        }
        bars.render();
    });
    // Wait for full completion of the builder.
    try {
        const { success } = await run.output
            .pipe((0, operators_1.tap)((result) => {
            if (result.success) {
                parentLogger.info(colors.green('SUCCESS'));
            }
            else {
                parentLogger.info(colors.red('FAILURE'));
            }
            parentLogger.info('Result: ' + JSON.stringify({ ...result, info: undefined }, null, 4));
            parentLogger.info('\nLogs:');
            logs.forEach((l) => parentLogger.next(l));
            logs.splice(0);
        }))
            .toPromise();
        await run.stop();
        bars.terminate();
        return success ? 0 : 1;
    }
    catch (err) {
        parentLogger.info(colors.red('ERROR'));
        parentLogger.info('\nLogs:');
        logs.forEach((l) => parentLogger.next(l));
        parentLogger.fatal('Exception:');
        parentLogger.fatal(err.stack);
        return 2;
    }
}
async function main(args) {
    /** Parse the command line. */
    const argv = (0, yargs_parser_1.default)(args, {
        boolean: ['help'],
        configuration: {
            'dot-notation': false,
            'boolean-negation': true,
            'strip-aliased': true,
            'camel-case-expansion': false,
        },
    });
    /** Create the DevKit Logger used through the CLI. */
    const logger = (0, node_2.createConsoleLogger)(argv['verbose'], process.stdout, process.stderr, {
        info: (s) => s,
        debug: (s) => s,
        warn: (s) => colors.bold.yellow(s),
        error: (s) => colors.bold.red(s),
        fatal: (s) => colors.bold.red(s),
    });
    // Check the target.
    const targetStr = argv._[0] || '';
    if (!targetStr || argv.help) {
        // Show architect usage if there's no target.
        usage(logger);
    }
    // Load workspace configuration file.
    const currentPath = process.cwd();
    const configFileNames = ['angular.json', '.angular.json', 'workspace.json', '.workspace.json'];
    const configFilePath = findUp(configFileNames, currentPath);
    if (!configFilePath) {
        logger.fatal(`Workspace configuration file (${configFileNames.join(', ')}) cannot be found in ` +
            `'${currentPath}' or in parent directories.`);
        return 3;
    }
    const root = path.dirname(configFilePath);
    const registry = new core_1.schema.CoreSchemaRegistry();
    registry.addPostTransform(core_1.schema.transforms.addUndefinedDefaults);
    // Show usage of deprecated options
    registry.useXDeprecatedProvider((msg) => logger.warn(msg));
    const { workspace } = await core_1.workspaces.readWorkspace(configFilePath, core_1.workspaces.createWorkspaceHost(new node_2.NodeJsSyncHost()));
    // Clear the console.
    process.stdout.write('\u001Bc');
    return await _executeTarget(logger, workspace, root, argv, registry);
}
main(process.argv.slice(2)).then((code) => {
    process.exit(code);
}, (err) => {
    // eslint-disable-next-line no-console
    console.error('Error: ' + err.stack || err.message || err);
    process.exit(-1);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXJjaGl0ZWN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYXJjaGl0ZWN0X2NsaS9iaW4vYXJjaGl0ZWN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQ0E7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgseURBQWlHO0FBQ2pHLHlEQUFtRjtBQUNuRiwrQ0FBK0U7QUFDL0Usb0RBQWdGO0FBQ2hGLHdEQUEwQztBQUMxQywyQkFBZ0M7QUFDaEMsMkNBQTZCO0FBQzdCLDhDQUFxQztBQUNyQyw2REFBa0U7QUFDbEUsOENBQW1EO0FBRW5ELFNBQVMsTUFBTSxDQUFDLEtBQXdCLEVBQUUsSUFBWTtJQUNwRCxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRTtRQUN6QixLQUFLLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQztLQUNqQjtJQUNELE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDO0lBRW5DLElBQUksVUFBVSxHQUFHLElBQUksQ0FBQztJQUN0QixPQUFPLFVBQVUsSUFBSSxVQUFVLEtBQUssSUFBSSxFQUFFO1FBQ3hDLEtBQUssTUFBTSxJQUFJLElBQUksS0FBSyxFQUFFO1lBQ3hCLE1BQU0sQ0FBQyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ3RDLElBQUksSUFBQSxlQUFVLEVBQUMsQ0FBQyxDQUFDLEVBQUU7Z0JBQ2pCLE9BQU8sQ0FBQyxDQUFDO2FBQ1Y7U0FDRjtRQUVELFVBQVUsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0tBQ3ZDO0lBRUQsT0FBTyxJQUFJLENBQUM7QUFDZCxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFTLEtBQUssQ0FBQyxNQUFzQixF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VUFBVSxDQUFDLG9CQUFvQixDQUFDLENBQUM7SUFFbEUsbUNBQW1DO0lBQ25DLFFBQVEsQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBRTNELE1BQU0sRUFBRSxTQUFTLEVBQUUsR0FBRyxNQUFNLGlCQUFVLENBQUMsYUFBYSxDQUNsRCxjQUFjLEVBQ2QsaUJBQVUsQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLHFCQUFjLEVBQUUsQ0FBQyxDQUNyRCxDQUFDO0lBRUYscUJBQXFCO0lBQ3JCLE9BQU8sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBRWhDLE9BQU8sTUFBTSxjQUFjLENBQUMsTUFBTSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxDQUFDO0FBQ3ZFLENBQUM7QUFFRCxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQzlCLENBQUMsSUFBSSxFQUFFLEVBQUU7SUFDUCxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ3JCLENBQUMsRUFDRCxDQUFDLEdBQUcsRUFBRSxFQUFFO0lBQ04sc0NBQXNDO0lBQ3RDLE9BQU8sQ0FBQyxLQUFLLENBQUMsU0FBUyxHQUFHLEdBQUcsQ0FBQyxLQUFLLElBQUksR0FBRyxDQUFDLE9BQU8sSUFBSSxHQUFHLENBQUMsQ0FBQztJQUMzRCxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDbkIsQ0FBQyxDQUNGLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIjIS91c3IvYmluL2VudiBub2RlXG4vKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgQXJjaGl0ZWN0LCBCdWlsZGVySW5mbywgQnVpbGRlclByb2dyZXNzU3RhdGUsIFRhcmdldCB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHsgV29ya3NwYWNlTm9kZU1vZHVsZXNBcmNoaXRlY3RIb3N0IH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdC9ub2RlJztcbmltcG9ydCB7IGpzb24sIGxvZ2dpbmcsIHNjaGVtYSwgdGFncywgd29ya3NwYWNlcyB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCB7IE5vZGVKc1N5bmNIb3N0LCBjcmVhdGVDb25zb2xlTG9nZ2VyIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUvbm9kZSc7XG5pbXBvcnQgKiBhcyBhbnNpQ29sb3JzIGZyb20gJ2Fuc2ktY29sb3JzJztcbmltcG9ydCB7IGV4aXN0c1N5bmMgfSBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgdGFwIH0gZnJvbSAncnhqcy9vcGVyYXRvcnMnO1xuaW1wb3J0IHlhcmdzUGFyc2VyLCB7IGNhbWVsQ2FzZSwgZGVjYW1lbGl6ZSB9IGZyb20gJ3lhcmdzLXBhcnNlcic7XG5pbXBvcnQgeyBNdWx0aVByb2dyZXNzQmFyIH0gZnJvbSAnLi4vc3JjL3Byb2dyZXNzJztcblxuZnVuY3Rpb24gZmluZFVwKG5hbWVzOiBzdHJpbmcgfCBzdHJpbmdbXSwgZnJvbTogc3RyaW5nKSB7XG4gIGlmICghQXJyYXkuaXNBcnJheShuYW1lcykpIHtcbiAgICBuYW1lcyA9IFtuYW1lc107XG4gIH1cbiAgY29uc3Qgcm9vdCA9IHBhdGgucGFyc2UoZnJvbSkucm9vdDtcblxuICBsZXQgY3VycmVudERpciA9IGZyb207XG4gIHdoaWxlIChjdXJyZW50RGlyICYmIGN1cnJlbnREaXIgIT09IHJvb3QpIHtcbiAgICBmb3IgKGNvbnN0IG5hbWUgb2YgbmFtZXMpIHtcbiAgICAgIGNvbnN0IHAgPSBwYXRoLmpvaW4oY3VycmVudERpciwgbmFtZSk7XG4gICAgICBpZiAoZXhpc3RzU3luYyhwKSkge1xuICAgICAgICByZXR1cm4gcDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjdXJyZW50RGlyID0gcGF0aC5kaXJuYW1lKGN1cnJlbnREaXIpO1xuICB9XG5cbiAgcmV0dXJuIG51bGw7XG59XG5cbi8qKlxuICogU2hvdyB1c2FnZSBvZiB0aGUgQ0xJIHRvb2wsIGFuZCBleGl0IHRoZSBwcm9jZXNzLlxuICovXG5mdW5jdGlvbiB1c2FnZShsb2dnZXI6IGxvZ2dpbmcuTG9nZ2VyLCBleGl0Q29kZSA9IDApOiBuZXZlciB7XG4gIGxvZ2dlci5pbmZvKHRhZ3Muc3RyaXBJbmRlbnRgXG4gICAgYXJjaGl0ZWN0IFtwcm9qZWN0XVs6dGFyZ2V0XVs6Y29uZmlndXJhdGlvbl0gW29wdGlvbnMsIC4uLl1cblxuICAgIFJ1biBhIHByb2plY3QgdGFyZ2V0LlxuICAgIElmIHByb2plY3QvdGFyZ2V0L2NvbmZpZ3VyYXRpb24gYXJlIG5vdCBzcGVjaWZpZWQsIHRoZSB3b3Jrc3BhY2UgZGVmYXVsdHMgd2lsbCBiZSB1c2VkLlxuXG4gICAgT3B0aW9uczpcbiAgICAgICAgLS1oZWxwICAgICAgICAgICAgICBTaG93IGF2YWlsYWJsZSBvcHRpb25zIGZvciBwcm9qZWN0IHRhcmdldC5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBTaG93cyB0aGlzIG1lc3NhZ2UgaW5zdGVhZCB3aGVuIHJhbiB3aXRob3V0IHRoZSBydW4gYXJndW1lbnQuXG5cblxuICAgIEFueSBhZGRpdGlvbmFsIG9wdGlvbiBpcyBwYXNzZWQgdGhlIHRhcmdldCwgb3ZlcnJpZGluZyBleGlzdGluZyBvcHRpb25zLlxuICBgKTtcblxuICByZXR1cm4gcHJvY2Vzcy5leGl0KGV4aXRDb2RlKTtcbn1cblxuZnVuY3Rpb24gX3RhcmdldFN0cmluZ0Zyb21UYXJnZXQoeyBwcm9qZWN0LCB0YXJnZXQsIGNvbmZpZ3VyYXRpb24gfTogVGFyZ2V0KSB7XG4gIHJldHVybiBgJHtwcm9qZWN0fToke3RhcmdldH0ke2NvbmZpZ3VyYXRpb24gIT09IHVuZGVmaW5lZCA/ICc6JyArIGNvbmZpZ3VyYXRpb24gOiAnJ31gO1xufVxuXG5pbnRlcmZhY2UgQmFySW5mbyB7XG4gIHN0YXR1cz86IHN0cmluZztcbiAgYnVpbGRlcjogQnVpbGRlckluZm87XG4gIHRhcmdldD86IFRhcmdldDtcbn1cblxuLy8gQ3JlYXRlIGEgc2VwYXJhdGUgaW5zdGFuY2UgdG8gcHJldmVudCB1bmludGVuZGVkIGdsb2JhbCBjaGFuZ2VzIHRvIHRoZSBjb2xvciBjb25maWd1cmF0aW9uXG4vLyBDcmVhdGUgZnVuY3Rpb24gaXMgbm90IGRlZmluZWQgaW4gdGhlIHR5cGluZ3MuIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL2Rvb3diL2Fuc2ktY29sb3JzL3B1bGwvNDRcbmNvbnN0IGNvbG9ycyA9IChhbnNpQ29sb3JzIGFzIHR5cGVvZiBhbnNpQ29sb3JzICYgeyBjcmVhdGU6ICgpID0+IHR5cGVvZiBhbnNpQ29sb3JzIH0pLmNyZWF0ZSgpO1xuXG5hc3luYyBmdW5jdGlvbiBfZXhlY3V0ZVRhcmdldChcbiAgcGFyZW50TG9nZ2VyOiBsb2dnaW5nLkxvZ2dlcixcbiAgd29ya3NwYWNlOiB3b3Jrc3BhY2VzLldvcmtzcGFjZURlZmluaXRpb24sXG4gIHJvb3Q6IHN0cmluZyxcbiAgYXJndjogeWFyZ3NQYXJzZXIuQXJndW1lbnRzLFxuICByZWdpc3RyeTogc2NoZW1hLlNjaGVtYVJlZ2lzdHJ5LFxuKSB7XG4gIGNvbnN0IGFyY2hpdGVjdEhvc3QgPSBuZXcgV29ya3NwYWNlTm9kZU1vZHVsZXNBcmNoaXRlY3RIb3N0KHdvcmtzcGFjZSwgcm9vdCk7XG4gIGNvbnN0IGFyY2hpdGVjdCA9IG5ldyBBcmNoaXRlY3QoYXJjaGl0ZWN0SG9zdCwgcmVnaXN0cnkpO1xuXG4gIC8vIFNwbGl0IGEgdGFyZ2V0IGludG8gaXRzIHBhcnRzLlxuICBjb25zdCB7XG4gICAgXzogW3RhcmdldFN0ciA9ICcnXSxcbiAgICBoZWxwLFxuICAgIC4uLm9wdGlvbnNcbiAgfSA9IGFyZ3Y7XG4gIGNvbnN0IFtwcm9qZWN0LCB0YXJnZXQsIGNvbmZpZ3VyYXRpb25dID0gdGFyZ2V0U3RyLnRvU3RyaW5nKCkuc3BsaXQoJzonKTtcbiAgY29uc3QgdGFyZ2V0U3BlYyA9IHsgcHJvamVjdCwgdGFyZ2V0LCBjb25maWd1cmF0aW9uIH07XG5cbiAgY29uc3QgbG9nZ2VyID0gbmV3IGxvZ2dpbmcuTG9nZ2VyKCdqb2JzJyk7XG4gIGNvbnN0IGxvZ3M6IGxvZ2dpbmcuTG9nRW50cnlbXSA9IFtdO1xuICBsb2dnZXIuc3Vic2NyaWJlKChlbnRyeSkgPT4gbG9ncy5wdXNoKHsgLi4uZW50cnksIG1lc3NhZ2U6IGAke2VudHJ5Lm5hbWV9OiBgICsgZW50cnkubWVzc2FnZSB9KSk7XG5cbiAgLy8gQ2FtZWxpemUgb3B0aW9ucyBhcyB5YXJncyB3aWxsIHJldHVybiB0aGUgb2JqZWN0IGluIGtlYmFiLWNhc2Ugd2hlbiBjYW1lbCBjYXNpbmcgaXMgZGlzYWJsZWQuXG4gIGNvbnN0IGNhbWVsQ2FzZWRPcHRpb25zOiBqc29uLkpzb25PYmplY3QgPSB7fTtcbiAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXMob3B0aW9ucykpIHtcbiAgICBpZiAoL1tBLVpdLy50ZXN0KGtleSkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biBhcmd1bWVudCAke2tleX0uIERpZCB5b3UgbWVhbiAke2RlY2FtZWxpemUoa2V5KX0/YCk7XG4gICAgfVxuXG4gICAgY2FtZWxDYXNlZE9wdGlvbnNbY2FtZWxDYXNlKGtleSldID0gdmFsdWU7XG4gIH1cblxuICBjb25zdCBydW4gPSBhd2FpdCBhcmNoaXRlY3Quc2NoZWR1bGVUYXJnZXQodGFyZ2V0U3BlYywgY2FtZWxDYXNlZE9wdGlvbnMsIHsgbG9nZ2VyIH0pO1xuICBjb25zdCBiYXJzID0gbmV3IE11bHRpUHJvZ3Jlc3NCYXI8bnVtYmVyLCBCYXJJbmZvPignOm5hbWUgOmJhciAoOmN1cnJlbnQvOnRvdGFsKSA6c3RhdHVzJyk7XG5cbiAgcnVuLnByb2dyZXNzLnN1YnNjcmliZSgodXBkYXRlKSA9PiB7XG4gICAgY29uc3QgZGF0YSA9IGJhcnMuZ2V0KHVwZGF0ZS5pZCkgfHwge1xuICAgICAgaWQ6IHVwZGF0ZS5pZCxcbiAgICAgIGJ1aWxkZXI6IHVwZGF0ZS5idWlsZGVyLFxuICAgICAgdGFyZ2V0OiB1cGRhdGUudGFyZ2V0LFxuICAgICAgc3RhdHVzOiB1cGRhdGUuc3RhdHVzIHx8ICcnLFxuICAgICAgbmFtZTogKFxuICAgICAgICAodXBkYXRlLnRhcmdldCA/IF90YXJnZXRTdHJpbmdGcm9tVGFyZ2V0KHVwZGF0ZS50YXJnZXQpIDogdXBkYXRlLmJ1aWxkZXIubmFtZSkgK1xuICAgICAgICAnICcucmVwZWF0KDgwKVxuICAgICAgKS5zdWJzdHJpbmcoMCwgNDApLFxuICAgIH07XG5cbiAgICBpZiAodXBkYXRlLnN0YXR1cyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBkYXRhLnN0YXR1cyA9IHVwZGF0ZS5zdGF0dXM7XG4gICAgfVxuXG4gICAgc3dpdGNoICh1cGRhdGUuc3RhdGUpIHtcbiAgICAgIGNhc2UgQnVpbGRlclByb2dyZXNzU3RhdGUuRXJyb3I6XG4gICAgICAgIGRhdGEuc3RhdHVzID0gJ0Vycm9yOiAnICsgdXBkYXRlLmVycm9yO1xuICAgICAgICBiYXJzLnVwZGF0ZSh1cGRhdGUuaWQsIGRhdGEpO1xuICAgICAgICBicmVhaztcblxuICAgICAgY2FzZSBCdWlsZGVyUHJvZ3Jlc3NTdGF0ZS5TdG9wcGVkOlxuICAgICAgICBkYXRhLnN0YXR1cyA9ICdEb25lLic7XG4gICAgICAgIGJhcnMuY29tcGxldGUodXBkYXRlLmlkKTtcbiAgICAgICAgYmFycy51cGRhdGUodXBkYXRlLmlkLCBkYXRhLCB1cGRhdGUudG90YWwsIHVwZGF0ZS50b3RhbCk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlIEJ1aWxkZXJQcm9ncmVzc1N0YXRlLldhaXRpbmc6XG4gICAgICAgIGJhcnMudXBkYXRlKHVwZGF0ZS5pZCwgZGF0YSk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlIEJ1aWxkZXJQcm9ncmVzc1N0YXRlLlJ1bm5pbmc6XG4gICAgICAgIGJhcnMudXBkYXRlKHVwZGF0ZS5pZCwgZGF0YSwgdXBkYXRlLmN1cnJlbnQsIHVwZGF0ZS50b3RhbCk7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIGJhcnMucmVuZGVyKCk7XG4gIH0pO1xuXG4gIC8vIFdhaXQgZm9yIGZ1bGwgY29tcGxldGlvbiBvZiB0aGUgYnVpbGRlci5cbiAgdHJ5IHtcbiAgICBjb25zdCB7IHN1Y2Nlc3MgfSA9IGF3YWl0IHJ1bi5vdXRwdXRcbiAgICAgIC5waXBlKFxuICAgICAgICB0YXAoKHJlc3VsdCkgPT4ge1xuICAgICAgICAgIGlmIChyZXN1bHQuc3VjY2Vzcykge1xuICAgICAgICAgICAgcGFyZW50TG9nZ2VyLmluZm8oY29sb3JzLmdyZWVuKCdTVUNDRVNTJykpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwYXJlbnRMb2dnZXIuaW5mbyhjb2xvcnMucmVkKCdGQUlMVVJFJykpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBwYXJlbnRMb2dnZXIuaW5mbygnUmVzdWx0OiAnICsgSlNPTi5zdHJpbmdpZnkoeyAuLi5yZXN1bHQsIGluZm86IHVuZGVmaW5lZCB9LCBudWxsLCA0KSk7XG5cbiAgICAgICAgICBwYXJlbnRMb2dnZXIuaW5mbygnXFxuTG9nczonKTtcbiAgICAgICAgICBsb2dzLmZvckVhY2goKGwpID0+IHBhcmVudExvZ2dlci5uZXh0KGwpKTtcbiAgICAgICAgICBsb2dzLnNwbGljZSgwKTtcbiAgICAgICAgfSksXG4gICAgICApXG4gICAgICAudG9Qcm9taXNlKCk7XG5cbiAgICBhd2FpdCBydW4uc3RvcCgpO1xuICAgIGJhcnMudGVybWluYXRlKCk7XG5cbiAgICByZXR1cm4gc3VjY2VzcyA/IDAgOiAxO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBwYXJlbnRMb2dnZXIuaW5mbyhjb2xvcnMucmVkKCdFUlJPUicpKTtcbiAgICBwYXJlbnRMb2dnZXIuaW5mbygnXFxuTG9nczonKTtcbiAgICBsb2dzLmZvckVhY2goKGwpID0+IHBhcmVudExvZ2dlci5uZXh0KGwpKTtcblxuICAgIHBhcmVudExvZ2dlci5mYXRhbCgnRXhjZXB0aW9uOicpO1xuICAgIHBhcmVudExvZ2dlci5mYXRhbChlcnIuc3RhY2spO1xuXG4gICAgcmV0dXJuIDI7XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gbWFpbihhcmdzOiBzdHJpbmdbXSk6IFByb21pc2U8bnVtYmVyPiB7XG4gIC8qKiBQYXJzZSB0aGUgY29tbWFuZCBsaW5lLiAqL1xuICBjb25zdCBhcmd2ID0geWFyZ3NQYXJzZXIoYXJncywge1xuICAgIGJvb2xlYW46IFsnaGVscCddLFxuICAgIGNvbmZpZ3VyYXRpb246IHtcbiAgICAgICdkb3Qtbm90YXRpb24nOiBmYWxzZSxcbiAgICAgICdib29sZWFuLW5lZ2F0aW9uJzogdHJ1ZSxcbiAgICAgICdzdHJpcC1hbGlhc2VkJzogdHJ1ZSxcbiAgICAgICdjYW1lbC1jYXNlLWV4cGFuc2lvbic6IGZhbHNlLFxuICAgIH0sXG4gIH0pO1xuXG4gIC8qKiBDcmVhdGUgdGhlIERldktpdCBMb2dnZXIgdXNlZCB0aHJvdWdoIHRoZSBDTEkuICovXG4gIGNvbnN0IGxvZ2dlciA9IGNyZWF0ZUNvbnNvbGVMb2dnZXIoYXJndlsndmVyYm9zZSddLCBwcm9jZXNzLnN0ZG91dCwgcHJvY2Vzcy5zdGRlcnIsIHtcbiAgICBpbmZvOiAocykgPT4gcyxcbiAgICBkZWJ1ZzogKHMpID0+IHMsXG4gICAgd2FybjogKHMpID0+IGNvbG9ycy5ib2xkLnllbGxvdyhzKSxcbiAgICBlcnJvcjogKHMpID0+IGNvbG9ycy5ib2xkLnJlZChzKSxcbiAgICBmYXRhbDogKHMpID0+IGNvbG9ycy5ib2xkLnJlZChzKSxcbiAgfSk7XG5cbiAgLy8gQ2hlY2sgdGhlIHRhcmdldC5cbiAgY29uc3QgdGFyZ2V0U3RyID0gYXJndi5fWzBdIHx8ICcnO1xuICBpZiAoIXRhcmdldFN0ciB8fCBhcmd2LmhlbHApIHtcbiAgICAvLyBTaG93IGFyY2hpdGVjdCB1c2FnZSBpZiB0aGVyZSdzIG5vIHRhcmdldC5cbiAgICB1c2FnZShsb2dnZXIpO1xuICB9XG5cbiAgLy8gTG9hZCB3b3Jrc3BhY2UgY29uZmlndXJhdGlvbiBmaWxlLlxuICBjb25zdCBjdXJyZW50UGF0aCA9IHByb2Nlc3MuY3dkKCk7XG4gIGNvbnN0IGNvbmZpZ0ZpbGVOYW1lcyA9IFsnYW5ndWxhci5qc29uJywgJy5hbmd1bGFyLmpzb24nLCAnd29ya3NwYWNlLmpzb24nLCAnLndvcmtzcGFjZS5qc29uJ107XG5cbiAgY29uc3QgY29uZmlnRmlsZVBhdGggPSBmaW5kVXAoY29uZmlnRmlsZU5hbWVzLCBjdXJyZW50UGF0aCk7XG5cbiAgaWYgKCFjb25maWdGaWxlUGF0aCkge1xuICAgIGxvZ2dlci5mYXRhbChcbiAgICAgIGBXb3Jrc3BhY2UgY29uZmlndXJhdGlvbiBmaWxlICgke2NvbmZpZ0ZpbGVOYW1lcy5qb2luKCcsICcpfSkgY2Fubm90IGJlIGZvdW5kIGluIGAgK1xuICAgICAgICBgJyR7Y3VycmVudFBhdGh9JyBvciBpbiBwYXJlbnQgZGlyZWN0b3JpZXMuYCxcbiAgICApO1xuXG4gICAgcmV0dXJuIDM7XG4gIH1cblxuICBjb25zdCByb290ID0gcGF0aC5kaXJuYW1lKGNvbmZpZ0ZpbGVQYXRoKTtcblxuICBjb25zdCByZWdpc3RyeSA9IG5ldyBzY2hlbWEuQ29yZVNjaGVtYVJlZ2lzdHJ5KCk7XG4gIHJlZ2lzdHJ5LmFkZFBvc3RUcmFuc2Zvcm0oc2NoZW1hLnRyYW5zZm9ybXMuYWRkVW5kZWZpbmVkRGVmYXVsdHMpO1xuXG4gIC8vIFNob3cgdXNhZ2Ugb2YgZGVwcmVjYXRlZCBvcHRpb25zXG4gIHJlZ2lzdHJ5LnVzZVhEZXByZWNhdGVkUHJvdmlkZXIoKG1zZykgPT4gbG9nZ2VyLndhcm4obXNnKSk7XG5cbiAgY29uc3QgeyB3b3Jrc3BhY2UgfSA9IGF3YWl0IHdvcmtzcGFjZXMucmVhZFdvcmtzcGFjZShcbiAgICBjb25maWdGaWxlUGF0aCxcbiAgICB3b3Jrc3BhY2VzLmNyZWF0ZVdvcmtzcGFjZUhvc3QobmV3IE5vZGVKc1N5bmNIb3N0KCkpLFxuICApO1xuXG4gIC8vIENsZWFyIHRoZSBjb25zb2xlLlxuICBwcm9jZXNzLnN0ZG91dC53cml0ZSgnXFx1MDAxQmMnKTtcblxuICByZXR1cm4gYXdhaXQgX2V4ZWN1dGVUYXJnZXQobG9nZ2VyLCB3b3Jrc3BhY2UsIHJvb3QsIGFyZ3YsIHJlZ2lzdHJ5KTtcbn1cblxubWFpbihwcm9jZXNzLmFyZ3Yuc2xpY2UoMikpLnRoZW4oXG4gIChjb2RlKSA9PiB7XG4gICAgcHJvY2Vzcy5leGl0KGNvZGUpO1xuICB9LFxuICAoZXJyKSA9PiB7XG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLWNvbnNvbGVcbiAgICBjb25zb2xlLmVycm9yKCdFcnJvcjogJyArIGVyci5zdGFjayB8fCBlcnIubWVzc2FnZSB8fCBlcnIpO1xuICAgIHByb2Nlc3MuZXhpdCgtMSk7XG4gIH0sXG4pO1xuIl19