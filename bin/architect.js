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
        const result = await run.output.toPromise();
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
        await run.stop();
        bars.terminate();
        return result.success ? 0 : 1;
    }
    catch (err) {
        parentLogger.info(colors.red('ERROR'));
        parentLogger.info('\nLogs:');
        logs.forEach((l) => parentLogger.next(l));
        parentLogger.fatal('Exception:');
        parentLogger.fatal((err instanceof Error && err.stack) || `${err}`);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXJjaGl0ZWN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYXJjaGl0ZWN0X2NsaS9iaW4vYXJjaGl0ZWN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQ0E7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgseURBQWlHO0FBQ2pHLHlEQUFtRjtBQUNuRiwrQ0FBMEY7QUFDMUYsb0RBQWdGO0FBQ2hGLHdEQUEwQztBQUMxQywyQkFBZ0M7QUFDaEMsMkNBQTZCO0FBQzdCLDZEQUFrRTtBQUNsRSw4Q0FBbUQ7QUFFbkQsU0FBUyxNQUFNLENBQUMsS0FBd0IsRUFBRSxJQUFZO0lBQ3BELElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFO1FBQ3pCLEtBQUssR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO0tBQ2pCO0lBQ0QsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUM7SUFFbkMsSUFBSSxVQUFVLEdBQUcsSUFBSSxDQUFDO0lBQ3RCLE9BQU8sVUFBVSxJQUFJLFVBQVUsS0FBSyxJQUFJLEVBQUU7UUFDeEMsS0FBSyxNQUFNLElBQUksSUFBSSxLQUFLLEVBQUU7WUFDeEIsTUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDdEMsSUFBSSxJQUFBLGVBQVUsRUFBQyxDQUFDLENBQUMsRUFBRTtnQkFDakIsT0FBTyxDQUFDLENBQUM7YUFDVjtTQUNGO1FBRUQsVUFBVSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUM7S0FDdkM7SUFFRCxPQUFPLElBQUksQ0FBQztBQUNkLENBQUM7QUFFRDs7R0FFRztBQUNILFNBQVMsS0FBSyxDQUFDLE1BQXNCLEVBQUUsUUFBUSxHQUFH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LENBQUMsc0JBQXNCLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztJQUUzRCxNQUFNLEVBQUUsU0FBUyxFQUFFLEdBQUcsTUFBTSxpQkFBVSxDQUFDLGFBQWEsQ0FDbEQsY0FBYyxFQUNkLGlCQUFVLENBQUMsbUJBQW1CLENBQUMsSUFBSSxxQkFBYyxFQUFFLENBQUMsQ0FDckQsQ0FBQztJQUVGLHFCQUFxQjtJQUNyQixPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUVoQyxPQUFPLE1BQU0sY0FBYyxDQUFDLE1BQU0sRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsQ0FBQztBQUN2RSxDQUFDO0FBRUQsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUM5QixDQUFDLElBQUksRUFBRSxFQUFFO0lBQ1AsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNyQixDQUFDLEVBQ0QsQ0FBQyxHQUFHLEVBQUUsRUFBRTtJQUNOLHNDQUFzQztJQUN0QyxPQUFPLENBQUMsS0FBSyxDQUFDLFNBQVMsR0FBRyxHQUFHLENBQUMsS0FBSyxJQUFJLEdBQUcsQ0FBQyxPQUFPLElBQUksR0FBRyxDQUFDLENBQUM7SUFDM0QsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ25CLENBQUMsQ0FDRixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiIyEvdXNyL2Jpbi9lbnYgbm9kZVxuLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IEFyY2hpdGVjdCwgQnVpbGRlckluZm8sIEJ1aWxkZXJQcm9ncmVzc1N0YXRlLCBUYXJnZXQgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB7IFdvcmtzcGFjZU5vZGVNb2R1bGVzQXJjaGl0ZWN0SG9zdCB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3Qvbm9kZSc7XG5pbXBvcnQgeyBKc29uVmFsdWUsIGpzb24sIGxvZ2dpbmcsIHNjaGVtYSwgdGFncywgd29ya3NwYWNlcyB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCB7IE5vZGVKc1N5bmNIb3N0LCBjcmVhdGVDb25zb2xlTG9nZ2VyIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUvbm9kZSc7XG5pbXBvcnQgKiBhcyBhbnNpQ29sb3JzIGZyb20gJ2Fuc2ktY29sb3JzJztcbmltcG9ydCB7IGV4aXN0c1N5bmMgfSBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHlhcmdzUGFyc2VyLCB7IGNhbWVsQ2FzZSwgZGVjYW1lbGl6ZSB9IGZyb20gJ3lhcmdzLXBhcnNlcic7XG5pbXBvcnQgeyBNdWx0aVByb2dyZXNzQmFyIH0gZnJvbSAnLi4vc3JjL3Byb2dyZXNzJztcblxuZnVuY3Rpb24gZmluZFVwKG5hbWVzOiBzdHJpbmcgfCBzdHJpbmdbXSwgZnJvbTogc3RyaW5nKSB7XG4gIGlmICghQXJyYXkuaXNBcnJheShuYW1lcykpIHtcbiAgICBuYW1lcyA9IFtuYW1lc107XG4gIH1cbiAgY29uc3Qgcm9vdCA9IHBhdGgucGFyc2UoZnJvbSkucm9vdDtcblxuICBsZXQgY3VycmVudERpciA9IGZyb207XG4gIHdoaWxlIChjdXJyZW50RGlyICYmIGN1cnJlbnREaXIgIT09IHJvb3QpIHtcbiAgICBmb3IgKGNvbnN0IG5hbWUgb2YgbmFtZXMpIHtcbiAgICAgIGNvbnN0IHAgPSBwYXRoLmpvaW4oY3VycmVudERpciwgbmFtZSk7XG4gICAgICBpZiAoZXhpc3RzU3luYyhwKSkge1xuICAgICAgICByZXR1cm4gcDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjdXJyZW50RGlyID0gcGF0aC5kaXJuYW1lKGN1cnJlbnREaXIpO1xuICB9XG5cbiAgcmV0dXJuIG51bGw7XG59XG5cbi8qKlxuICogU2hvdyB1c2FnZSBvZiB0aGUgQ0xJIHRvb2wsIGFuZCBleGl0IHRoZSBwcm9jZXNzLlxuICovXG5mdW5jdGlvbiB1c2FnZShsb2dnZXI6IGxvZ2dpbmcuTG9nZ2VyLCBleGl0Q29kZSA9IDApOiBuZXZlciB7XG4gIGxvZ2dlci5pbmZvKHRhZ3Muc3RyaXBJbmRlbnRgXG4gICAgYXJjaGl0ZWN0IFtwcm9qZWN0XVs6dGFyZ2V0XVs6Y29uZmlndXJhdGlvbl0gW29wdGlvbnMsIC4uLl1cblxuICAgIFJ1biBhIHByb2plY3QgdGFyZ2V0LlxuICAgIElmIHByb2plY3QvdGFyZ2V0L2NvbmZpZ3VyYXRpb24gYXJlIG5vdCBzcGVjaWZpZWQsIHRoZSB3b3Jrc3BhY2UgZGVmYXVsdHMgd2lsbCBiZSB1c2VkLlxuXG4gICAgT3B0aW9uczpcbiAgICAgICAgLS1oZWxwICAgICAgICAgICAgICBTaG93IGF2YWlsYWJsZSBvcHRpb25zIGZvciBwcm9qZWN0IHRhcmdldC5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBTaG93cyB0aGlzIG1lc3NhZ2UgaW5zdGVhZCB3aGVuIHJhbiB3aXRob3V0IHRoZSBydW4gYXJndW1lbnQuXG5cblxuICAgIEFueSBhZGRpdGlvbmFsIG9wdGlvbiBpcyBwYXNzZWQgdGhlIHRhcmdldCwgb3ZlcnJpZGluZyBleGlzdGluZyBvcHRpb25zLlxuICBgKTtcblxuICByZXR1cm4gcHJvY2Vzcy5leGl0KGV4aXRDb2RlKTtcbn1cblxuZnVuY3Rpb24gX3RhcmdldFN0cmluZ0Zyb21UYXJnZXQoeyBwcm9qZWN0LCB0YXJnZXQsIGNvbmZpZ3VyYXRpb24gfTogVGFyZ2V0KSB7XG4gIHJldHVybiBgJHtwcm9qZWN0fToke3RhcmdldH0ke2NvbmZpZ3VyYXRpb24gIT09IHVuZGVmaW5lZCA/ICc6JyArIGNvbmZpZ3VyYXRpb24gOiAnJ31gO1xufVxuXG5pbnRlcmZhY2UgQmFySW5mbyB7XG4gIHN0YXR1cz86IHN0cmluZztcbiAgYnVpbGRlcjogQnVpbGRlckluZm87XG4gIHRhcmdldD86IFRhcmdldDtcbn1cblxuLy8gQ3JlYXRlIGEgc2VwYXJhdGUgaW5zdGFuY2UgdG8gcHJldmVudCB1bmludGVuZGVkIGdsb2JhbCBjaGFuZ2VzIHRvIHRoZSBjb2xvciBjb25maWd1cmF0aW9uXG5jb25zdCBjb2xvcnMgPSBhbnNpQ29sb3JzLmNyZWF0ZSgpO1xuXG5hc3luYyBmdW5jdGlvbiBfZXhlY3V0ZVRhcmdldChcbiAgcGFyZW50TG9nZ2VyOiBsb2dnaW5nLkxvZ2dlcixcbiAgd29ya3NwYWNlOiB3b3Jrc3BhY2VzLldvcmtzcGFjZURlZmluaXRpb24sXG4gIHJvb3Q6IHN0cmluZyxcbiAgYXJndjogUmV0dXJuVHlwZTx0eXBlb2YgeWFyZ3NQYXJzZXI+LFxuICByZWdpc3RyeTogc2NoZW1hLlNjaGVtYVJlZ2lzdHJ5LFxuKSB7XG4gIGNvbnN0IGFyY2hpdGVjdEhvc3QgPSBuZXcgV29ya3NwYWNlTm9kZU1vZHVsZXNBcmNoaXRlY3RIb3N0KHdvcmtzcGFjZSwgcm9vdCk7XG4gIGNvbnN0IGFyY2hpdGVjdCA9IG5ldyBBcmNoaXRlY3QoYXJjaGl0ZWN0SG9zdCwgcmVnaXN0cnkpO1xuXG4gIC8vIFNwbGl0IGEgdGFyZ2V0IGludG8gaXRzIHBhcnRzLlxuICBjb25zdCB7XG4gICAgXzogW3RhcmdldFN0ciA9ICcnXSxcbiAgICBoZWxwLFxuICAgIC4uLm9wdGlvbnNcbiAgfSA9IGFyZ3Y7XG4gIGNvbnN0IFtwcm9qZWN0LCB0YXJnZXQsIGNvbmZpZ3VyYXRpb25dID0gdGFyZ2V0U3RyLnRvU3RyaW5nKCkuc3BsaXQoJzonKTtcbiAgY29uc3QgdGFyZ2V0U3BlYyA9IHsgcHJvamVjdCwgdGFyZ2V0LCBjb25maWd1cmF0aW9uIH07XG5cbiAgY29uc3QgbG9nZ2VyID0gbmV3IGxvZ2dpbmcuTG9nZ2VyKCdqb2JzJyk7XG4gIGNvbnN0IGxvZ3M6IGxvZ2dpbmcuTG9nRW50cnlbXSA9IFtdO1xuICBsb2dnZXIuc3Vic2NyaWJlKChlbnRyeSkgPT4gbG9ncy5wdXNoKHsgLi4uZW50cnksIG1lc3NhZ2U6IGAke2VudHJ5Lm5hbWV9OiBgICsgZW50cnkubWVzc2FnZSB9KSk7XG5cbiAgLy8gQ2FtZWxpemUgb3B0aW9ucyBhcyB5YXJncyB3aWxsIHJldHVybiB0aGUgb2JqZWN0IGluIGtlYmFiLWNhc2Ugd2hlbiBjYW1lbCBjYXNpbmcgaXMgZGlzYWJsZWQuXG4gIGNvbnN0IGNhbWVsQ2FzZWRPcHRpb25zOiBqc29uLkpzb25PYmplY3QgPSB7fTtcbiAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXMob3B0aW9ucykpIHtcbiAgICBpZiAoL1tBLVpdLy50ZXN0KGtleSkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biBhcmd1bWVudCAke2tleX0uIERpZCB5b3UgbWVhbiAke2RlY2FtZWxpemUoa2V5KX0/YCk7XG4gICAgfVxuXG4gICAgY2FtZWxDYXNlZE9wdGlvbnNbY2FtZWxDYXNlKGtleSldID0gdmFsdWUgYXMgSnNvblZhbHVlO1xuICB9XG5cbiAgY29uc3QgcnVuID0gYXdhaXQgYXJjaGl0ZWN0LnNjaGVkdWxlVGFyZ2V0KHRhcmdldFNwZWMsIGNhbWVsQ2FzZWRPcHRpb25zLCB7IGxvZ2dlciB9KTtcbiAgY29uc3QgYmFycyA9IG5ldyBNdWx0aVByb2dyZXNzQmFyPG51bWJlciwgQmFySW5mbz4oJzpuYW1lIDpiYXIgKDpjdXJyZW50Lzp0b3RhbCkgOnN0YXR1cycpO1xuXG4gIHJ1bi5wcm9ncmVzcy5zdWJzY3JpYmUoKHVwZGF0ZSkgPT4ge1xuICAgIGNvbnN0IGRhdGEgPSBiYXJzLmdldCh1cGRhdGUuaWQpIHx8IHtcbiAgICAgIGlkOiB1cGRhdGUuaWQsXG4gICAgICBidWlsZGVyOiB1cGRhdGUuYnVpbGRlcixcbiAgICAgIHRhcmdldDogdXBkYXRlLnRhcmdldCxcbiAgICAgIHN0YXR1czogdXBkYXRlLnN0YXR1cyB8fCAnJyxcbiAgICAgIG5hbWU6IChcbiAgICAgICAgKHVwZGF0ZS50YXJnZXQgPyBfdGFyZ2V0U3RyaW5nRnJvbVRhcmdldCh1cGRhdGUudGFyZ2V0KSA6IHVwZGF0ZS5idWlsZGVyLm5hbWUpICtcbiAgICAgICAgJyAnLnJlcGVhdCg4MClcbiAgICAgICkuc3Vic3RyaW5nKDAsIDQwKSxcbiAgICB9O1xuXG4gICAgaWYgKHVwZGF0ZS5zdGF0dXMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgZGF0YS5zdGF0dXMgPSB1cGRhdGUuc3RhdHVzO1xuICAgIH1cblxuICAgIHN3aXRjaCAodXBkYXRlLnN0YXRlKSB7XG4gICAgICBjYXNlIEJ1aWxkZXJQcm9ncmVzc1N0YXRlLkVycm9yOlxuICAgICAgICBkYXRhLnN0YXR1cyA9ICdFcnJvcjogJyArIHVwZGF0ZS5lcnJvcjtcbiAgICAgICAgYmFycy51cGRhdGUodXBkYXRlLmlkLCBkYXRhKTtcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGNhc2UgQnVpbGRlclByb2dyZXNzU3RhdGUuU3RvcHBlZDpcbiAgICAgICAgZGF0YS5zdGF0dXMgPSAnRG9uZS4nO1xuICAgICAgICBiYXJzLmNvbXBsZXRlKHVwZGF0ZS5pZCk7XG4gICAgICAgIGJhcnMudXBkYXRlKHVwZGF0ZS5pZCwgZGF0YSwgdXBkYXRlLnRvdGFsLCB1cGRhdGUudG90YWwpO1xuICAgICAgICBicmVhaztcblxuICAgICAgY2FzZSBCdWlsZGVyUHJvZ3Jlc3NTdGF0ZS5XYWl0aW5nOlxuICAgICAgICBiYXJzLnVwZGF0ZSh1cGRhdGUuaWQsIGRhdGEpO1xuICAgICAgICBicmVhaztcblxuICAgICAgY2FzZSBCdWlsZGVyUHJvZ3Jlc3NTdGF0ZS5SdW5uaW5nOlxuICAgICAgICBiYXJzLnVwZGF0ZSh1cGRhdGUuaWQsIGRhdGEsIHVwZGF0ZS5jdXJyZW50LCB1cGRhdGUudG90YWwpO1xuICAgICAgICBicmVhaztcbiAgICB9XG5cbiAgICBiYXJzLnJlbmRlcigpO1xuICB9KTtcblxuICAvLyBXYWl0IGZvciBmdWxsIGNvbXBsZXRpb24gb2YgdGhlIGJ1aWxkZXIuXG4gIHRyeSB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcnVuLm91dHB1dC50b1Byb21pc2UoKTtcbiAgICBpZiAocmVzdWx0LnN1Y2Nlc3MpIHtcbiAgICAgIHBhcmVudExvZ2dlci5pbmZvKGNvbG9ycy5ncmVlbignU1VDQ0VTUycpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcGFyZW50TG9nZ2VyLmluZm8oY29sb3JzLnJlZCgnRkFJTFVSRScpKTtcbiAgICB9XG4gICAgcGFyZW50TG9nZ2VyLmluZm8oJ1Jlc3VsdDogJyArIEpTT04uc3RyaW5naWZ5KHsgLi4ucmVzdWx0LCBpbmZvOiB1bmRlZmluZWQgfSwgbnVsbCwgNCkpO1xuXG4gICAgcGFyZW50TG9nZ2VyLmluZm8oJ1xcbkxvZ3M6Jyk7XG4gICAgbG9ncy5mb3JFYWNoKChsKSA9PiBwYXJlbnRMb2dnZXIubmV4dChsKSk7XG4gICAgbG9ncy5zcGxpY2UoMCk7XG5cbiAgICBhd2FpdCBydW4uc3RvcCgpO1xuICAgIGJhcnMudGVybWluYXRlKCk7XG5cbiAgICByZXR1cm4gcmVzdWx0LnN1Y2Nlc3MgPyAwIDogMTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgcGFyZW50TG9nZ2VyLmluZm8oY29sb3JzLnJlZCgnRVJST1InKSk7XG4gICAgcGFyZW50TG9nZ2VyLmluZm8oJ1xcbkxvZ3M6Jyk7XG4gICAgbG9ncy5mb3JFYWNoKChsKSA9PiBwYXJlbnRMb2dnZXIubmV4dChsKSk7XG5cbiAgICBwYXJlbnRMb2dnZXIuZmF0YWwoJ0V4Y2VwdGlvbjonKTtcbiAgICBwYXJlbnRMb2dnZXIuZmF0YWwoKGVyciBpbnN0YW5jZW9mIEVycm9yICYmIGVyci5zdGFjaykgfHwgYCR7ZXJyfWApO1xuXG4gICAgcmV0dXJuIDI7XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gbWFpbihhcmdzOiBzdHJpbmdbXSk6IFByb21pc2U8bnVtYmVyPiB7XG4gIC8qKiBQYXJzZSB0aGUgY29tbWFuZCBsaW5lLiAqL1xuICBjb25zdCBhcmd2ID0geWFyZ3NQYXJzZXIoYXJncywge1xuICAgIGJvb2xlYW46IFsnaGVscCddLFxuICAgIGNvbmZpZ3VyYXRpb246IHtcbiAgICAgICdkb3Qtbm90YXRpb24nOiBmYWxzZSxcbiAgICAgICdib29sZWFuLW5lZ2F0aW9uJzogdHJ1ZSxcbiAgICAgICdzdHJpcC1hbGlhc2VkJzogdHJ1ZSxcbiAgICAgICdjYW1lbC1jYXNlLWV4cGFuc2lvbic6IGZhbHNlLFxuICAgIH0sXG4gIH0pO1xuXG4gIC8qKiBDcmVhdGUgdGhlIERldktpdCBMb2dnZXIgdXNlZCB0aHJvdWdoIHRoZSBDTEkuICovXG4gIGNvbnN0IGxvZ2dlciA9IGNyZWF0ZUNvbnNvbGVMb2dnZXIoYXJndlsndmVyYm9zZSddLCBwcm9jZXNzLnN0ZG91dCwgcHJvY2Vzcy5zdGRlcnIsIHtcbiAgICBpbmZvOiAocykgPT4gcyxcbiAgICBkZWJ1ZzogKHMpID0+IHMsXG4gICAgd2FybjogKHMpID0+IGNvbG9ycy5ib2xkLnllbGxvdyhzKSxcbiAgICBlcnJvcjogKHMpID0+IGNvbG9ycy5ib2xkLnJlZChzKSxcbiAgICBmYXRhbDogKHMpID0+IGNvbG9ycy5ib2xkLnJlZChzKSxcbiAgfSk7XG5cbiAgLy8gQ2hlY2sgdGhlIHRhcmdldC5cbiAgY29uc3QgdGFyZ2V0U3RyID0gYXJndi5fWzBdIHx8ICcnO1xuICBpZiAoIXRhcmdldFN0ciB8fCBhcmd2LmhlbHApIHtcbiAgICAvLyBTaG93IGFyY2hpdGVjdCB1c2FnZSBpZiB0aGVyZSdzIG5vIHRhcmdldC5cbiAgICB1c2FnZShsb2dnZXIpO1xuICB9XG5cbiAgLy8gTG9hZCB3b3Jrc3BhY2UgY29uZmlndXJhdGlvbiBmaWxlLlxuICBjb25zdCBjdXJyZW50UGF0aCA9IHByb2Nlc3MuY3dkKCk7XG4gIGNvbnN0IGNvbmZpZ0ZpbGVOYW1lcyA9IFsnYW5ndWxhci5qc29uJywgJy5hbmd1bGFyLmpzb24nLCAnd29ya3NwYWNlLmpzb24nLCAnLndvcmtzcGFjZS5qc29uJ107XG5cbiAgY29uc3QgY29uZmlnRmlsZVBhdGggPSBmaW5kVXAoY29uZmlnRmlsZU5hbWVzLCBjdXJyZW50UGF0aCk7XG5cbiAgaWYgKCFjb25maWdGaWxlUGF0aCkge1xuICAgIGxvZ2dlci5mYXRhbChcbiAgICAgIGBXb3Jrc3BhY2UgY29uZmlndXJhdGlvbiBmaWxlICgke2NvbmZpZ0ZpbGVOYW1lcy5qb2luKCcsICcpfSkgY2Fubm90IGJlIGZvdW5kIGluIGAgK1xuICAgICAgICBgJyR7Y3VycmVudFBhdGh9JyBvciBpbiBwYXJlbnQgZGlyZWN0b3JpZXMuYCxcbiAgICApO1xuXG4gICAgcmV0dXJuIDM7XG4gIH1cblxuICBjb25zdCByb290ID0gcGF0aC5kaXJuYW1lKGNvbmZpZ0ZpbGVQYXRoKTtcblxuICBjb25zdCByZWdpc3RyeSA9IG5ldyBzY2hlbWEuQ29yZVNjaGVtYVJlZ2lzdHJ5KCk7XG4gIHJlZ2lzdHJ5LmFkZFBvc3RUcmFuc2Zvcm0oc2NoZW1hLnRyYW5zZm9ybXMuYWRkVW5kZWZpbmVkRGVmYXVsdHMpO1xuXG4gIC8vIFNob3cgdXNhZ2Ugb2YgZGVwcmVjYXRlZCBvcHRpb25zXG4gIHJlZ2lzdHJ5LnVzZVhEZXByZWNhdGVkUHJvdmlkZXIoKG1zZykgPT4gbG9nZ2VyLndhcm4obXNnKSk7XG5cbiAgY29uc3QgeyB3b3Jrc3BhY2UgfSA9IGF3YWl0IHdvcmtzcGFjZXMucmVhZFdvcmtzcGFjZShcbiAgICBjb25maWdGaWxlUGF0aCxcbiAgICB3b3Jrc3BhY2VzLmNyZWF0ZVdvcmtzcGFjZUhvc3QobmV3IE5vZGVKc1N5bmNIb3N0KCkpLFxuICApO1xuXG4gIC8vIENsZWFyIHRoZSBjb25zb2xlLlxuICBwcm9jZXNzLnN0ZG91dC53cml0ZSgnXFx1MDAxQmMnKTtcblxuICByZXR1cm4gYXdhaXQgX2V4ZWN1dGVUYXJnZXQobG9nZ2VyLCB3b3Jrc3BhY2UsIHJvb3QsIGFyZ3YsIHJlZ2lzdHJ5KTtcbn1cblxubWFpbihwcm9jZXNzLmFyZ3Yuc2xpY2UoMikpLnRoZW4oXG4gIChjb2RlKSA9PiB7XG4gICAgcHJvY2Vzcy5leGl0KGNvZGUpO1xuICB9LFxuICAoZXJyKSA9PiB7XG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLWNvbnNvbGVcbiAgICBjb25zb2xlLmVycm9yKCdFcnJvcjogJyArIGVyci5zdGFjayB8fCBlcnIubWVzc2FnZSB8fCBlcnIpO1xuICAgIHByb2Nlc3MuZXhpdCgtMSk7XG4gIH0sXG4pO1xuIl19