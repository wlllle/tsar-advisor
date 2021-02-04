# TSAR Advisor

This extension proposes some useful information about a program to simplify its parallelization.
It also provide some useful source-to-source transformations for programs as well as automate theire parallelization.
The advisor currently support C/C++ languages and based on LLVM & Clang projects.

To analyse or transform source code:

* Open C/C++ file
* Use context menu or type one of available TSAR commands in the Command Palette.
* If `TSAR: Analyse file` action is used the description of discovered traits is rendered in the new tab.
* If some transformation is requested, the original file is changed on success.
* Some diagnostic messages may be also provided.

> __Attention.__ To run the adviser the TSAR tool must be installed. It must be available in the system PATH or the path to `tsar-server` executable must be configured manually (see `Analysis Server` configuration variable for details). Details about the TSAR tool can be found in [TSAR Wiki](https://github.com/dvm-system/tsar/wiki).
