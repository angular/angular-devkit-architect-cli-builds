#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const architect_1 = require("@angular-devkit/architect");
const node_1 = require("@angular-devkit/architect/node");
const core_1 = require("@angular-devkit/core");
const node_2 = require("@angular-devkit/core/node");
const fs_1 = require("fs");
const minimist = require("minimist");
const path = require("path");
const operators_1 = require("rxjs/operators");
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
            if (fs_1.existsSync(p)) {
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
    process.exit(exitCode);
    throw 0; // The node typing sometimes don't have a never type for process.exit().
}
function _targetStringFromTarget({ project, target, configuration }) {
    return `${project}:${target}${configuration !== undefined ? ':' + configuration : ''}`;
}
async function _executeTarget(parentLogger, workspace, root, argv, registry) {
    const architectHost = new node_1.WorkspaceNodeModulesArchitectHost(workspace, root);
    const architect = new architect_1.Architect(architectHost, registry);
    // Split a target into its parts.
    const targetStr = argv._.shift() || '';
    const [project, target, configuration] = targetStr.split(':');
    const targetSpec = { project, target, configuration };
    delete argv['help'];
    delete argv['_'];
    const logger = new core_1.logging.Logger('jobs');
    const logs = [];
    logger.subscribe(entry => logs.push(Object.assign({}, entry, { message: `${entry.name}: ` + entry.message })));
    const run = await architect.scheduleTarget(targetSpec, argv, { logger });
    const bars = new progress_1.MultiProgressBar(':name :bar (:current/:total) :status');
    run.progress.subscribe(update => {
        const data = bars.get(update.id) || {
            id: update.id,
            builder: update.builder,
            target: update.target,
            status: update.status || '',
            name: ((update.target ? _targetStringFromTarget(update.target) : update.builder.name)
                + ' '.repeat(80)).substr(0, 40),
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
        const { success } = await run.output.pipe(operators_1.tap(result => {
            if (result.success) {
                parentLogger.info(core_1.terminal.green('SUCCESS'));
            }
            else {
                parentLogger.info(core_1.terminal.yellow('FAILURE'));
            }
            parentLogger.info('Result: ' + JSON.stringify(Object.assign({}, result, { info: undefined }), null, 4));
            parentLogger.info('\nLogs:');
            logs.forEach(l => parentLogger.next(l));
            logs.splice(0);
        })).toPromise();
        await run.stop();
        bars.terminate();
        return success ? 0 : 1;
    }
    catch (err) {
        parentLogger.info(core_1.terminal.red('ERROR'));
        parentLogger.info('\nLogs:');
        logs.forEach(l => parentLogger.next(l));
        parentLogger.fatal('Exception:');
        parentLogger.fatal(err.stack);
        return 2;
    }
}
async function main(args) {
    /** Parse the command line. */
    const argv = minimist(args, { boolean: ['help'] });
    /** Create the DevKit Logger used through the CLI. */
    const logger = node_2.createConsoleLogger(argv['verbose']);
    // Check the target.
    const targetStr = argv._[0] || '';
    if (!targetStr || argv.help) {
        // Show architect usage if there's no target.
        usage(logger);
    }
    // Load workspace configuration file.
    const currentPath = process.cwd();
    const configFileNames = [
        'angular.json',
        '.angular.json',
        'workspace.json',
        '.workspace.json',
    ];
    const configFilePath = findUp(configFileNames, currentPath);
    if (!configFilePath) {
        logger.fatal(`Workspace configuration file (${configFileNames.join(', ')}) cannot be found in `
            + `'${currentPath}' or in parent directories.`);
        return 3;
    }
    const root = path.dirname(configFilePath);
    const configContent = fs_1.readFileSync(configFilePath, 'utf-8');
    const workspaceJson = JSON.parse(configContent);
    const registry = new core_1.schema.CoreSchemaRegistry();
    registry.addPostTransform(core_1.schema.transforms.addUndefinedDefaults);
    const host = new node_2.NodeJsSyncHost();
    const workspace = new core_1.experimental.workspace.Workspace(core_1.normalize(root), host);
    await workspace.loadWorkspaceFromJson(workspaceJson).toPromise();
    // Clear the console.
    process.stdout.write('\u001Bc');
    return await _executeTarget(logger, workspace, root, argv, registry);
}
main(process.argv.slice(2))
    .then(code => {
    process.exit(code);
}, err => {
    console.error('Error: ' + err.stack || err.message || err);
    process.exit(-1);
});
