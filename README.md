# TSAR Advisor

This extension proposes some useful information about a program to simplify its parallelization.
The advisor currently support C/C++ languages and based on LLVM & Clang projects.

To analyse source code:
* Open C/C++ file
* Use editor context menu to select `TSAR: Analyse file` item
* The description of discovered traits is rendered in the new tab
* Use editor context menu item `TSAR: Close session` to stop analysis

## Features

At this moment only analysis statistic can be presented.

## Known Issues

Error occurs if sources include files from standard C/C++ library.