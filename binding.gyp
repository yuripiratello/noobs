{
    "targets": [{
        "target_name": "noobs",
        "cflags!": [ "-fno-exceptions" ],
        "cflags_cc!": [ "-fno-exceptions" ],
        "sources": [
            "src/main.cpp",
            "src/obs_interface.cpp",
            "src/utils.cpp",
        ],
        'include_dirs': [
            "<!@(node -p \"require('node-addon-api').include\")",
            "include"
        ],
        'dependencies': [
            "<!(node -p \"require('node-addon-api').gyp\")"
        ],
        'defines': [ 'NAPI_DISABLE_CPP_EXCEPTIONS' ],
        'conditions': [
            ['OS=="win"', {
                'libraries': [
                    "../bin/64bit/obs.lib",
                ],
            }],
            ['OS=="mac"', {
                # Phase 1 of macOS port: link against libobs.framework.
                # Source: Streamlabs OSN tarball during the spike, which
                # ships an arm64 libobs.framework next to its own client
                # binding. Path resolved at gyp time; expects an OSN
                # checkout sibling to this noobs repo (../obs-studio-node).
                # Phase 5 replaces this with a libobs we build ourselves
                # under Frameworks/libobs.framework in this repo.
                'libraries': [
                    '-Wl,-rpath,@loader_path/../../Frameworks',
                    '-F<(module_root_dir)/Frameworks',
                    '-framework libobs',
                ],
                'xcode_settings': {
                    'CLANG_CXX_LANGUAGE_STANDARD': 'c++17',
                    'CLANG_CXX_LIBRARY': 'libc++',
                    'MACOSX_DEPLOYMENT_TARGET': '11.0',
                    # The C++ source uses `throw std::runtime_error(...)` in
                    # several error paths. Default node-gyp on macOS sets
                    # GCC_ENABLE_CPP_EXCEPTIONS = NO and adds -fno-exceptions
                    # via Xcode defaults, which would fail to compile. Re-enable
                    # exceptions for our build.
                    'GCC_ENABLE_CPP_EXCEPTIONS': 'YES',
                    'OTHER_CPLUSPLUSFLAGS': [
                        '-Wno-deprecated-declarations',
                    ],
                },
            }],
        ],
    }]
}