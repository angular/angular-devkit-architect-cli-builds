
# Snapshot build of @angular-devkit/architect-cli

This repository is a snapshot of a commit on the original repository. The original code used to
generate this is located at http://github.com/angular/angular-cli.

We do not accept PRs or Issues opened on this repository. You should not use this over a tested and
released version of this package.

To test this snapshot in your own project, use

```bash
npm install git+https://github.com/angular/angular-devkit-architect-cli-builds.git
```

----
# Architect CLI

This package contains the executable for running an [Architect Builder](/packages/angular_devkit/architect/README.md).

# Usage

```
architect [project][:target][:configuration] [options, ...]

Run a project target.
If project/target/configuration are not specified, the workspace defaults will be used.

Options:
    --help              Show available options for project target.
                        Shows this message instead when ran without the run argument.


Any additional option is passed the target, overriding existing options.
```
