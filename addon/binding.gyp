{
  "targets": [
    {
      "variables": {
        "tsar-build": "tsar",
        "bcl": "idb\\trunk\\src\\base"
      },
      "target_name": "bclSocket",
      "sources": [
        "<@(bcl)/NodeJSSocket.cpp"
      ],
      "include_dirs": [
        "<@(bcl)"
      ],
      "link_settings": {
        "libraries": [
          "-ltsar"
        ]
      },
      "cflags": [
        "-std=c++11"
      ],
      "conditions": [
        [
          "OS=='linux'",
          {
            "link_settings": {
              "libraries": [
                "-L<@(tsar-build)"
              ]
            }
          }
        ],
        [
          "OS=='win'",
          {
            "configurations": {
              "Debug": {
                "msvs_settings": {
                  "VCCLCompilerTool": {
                    "RuntimeLibrary": 3
                  },
                  "VCLinkerTool": {
                    "AdditionalLibraryDirectories": [
                      "<@(tsar-build)/Debug/"
                    ]
                  }
                }
              },
              "Release": {
                "msvs_settings": {
                  "VCCLCompilerTool": {
                    "RuntimeLibrary": 2
                  },
                  "VCLinkerTool": {
                    "AdditionalLibraryDirectories": [
                      "<@(tsar-build)/Release/"
                    ]
                  }
                }
              }
            }
          }
        ]
      ]
    }
  ]
}