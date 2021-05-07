//===--- tools.ts --------  List of Available Tools --------- TypeScript --===//
//
//                           TSAR Advisor (SAPFOR)
//
// All standalone tools used in TSAR Advisor should be listed in this file.
// Each tool should be implemented as a server.
//
//===----------------------------------------------------------------------===//
import * as path from 'path';

export default
{
  tools: [
    {
      name: "tsar",
      options: [
        {
            label: 'Use External Analysis',
            description: 'Use external analysis results to clarify analysis',
            target: '-fanalysis-use=',
            selectFile: {
              filters: {'Json': ['json']},
              openLabel: 'Load Analysis',
            }
        },
        {
            label: 'User-Defined Options',
            description: 'Manually specify command line options',
            manualInput: true,
        },
        {
            label: 'Assume Inbound Subscripts',
            description: 'Assume that subscript expression is in bounds value of an array dimension',
            target: '-finbounds-subscripts'
        },
        {
            label: 'Ignore Redundant Memory',
            description: 'Try to discard influence of redundant memory on the analysis results',
            target: '-fignore-redundant-memory'
        },
        {
            label: 'Assume No External Calls',
            description: 'Assume that functions are never called outside the analyzed module',
            target: '-fno-external-calls'
        },
        {
            label: 'Disable Math Errno',
            description: 'Prevent math functions to indicate errors by setting errno',
            target: '-fno-math-errno'
        },
        {
            label: 'Ignore Library Functions',
            description: 'Do not perform analysis of library functions',
            target: '-fno-analyze-library-functions',
        },
        {
            label: 'Safe Type Cast',
            description: 'Disallow unsafe integer type cast in analysis passes',
            target: '-fsafe-type-cast'
        },
        {
            label: 'Allow Unsafe Transformation',
            description: 'Perform analysis after unsafe IR-level transformations',
            target: '-funsafe-tfm-analysis'
        },
        {
            label: 'Disable Clang Format',
            description: 'Disable format of transformed sources',
            target: '-no-format'
        }
     ]
    }
  ]
}