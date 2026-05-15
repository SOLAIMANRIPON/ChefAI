'use strict';

/**
 * Windows + NDK 27: prefab CMake targets sometimes omit explicit libc++ linkage → lld undefined
 * std::__ndk1 / __cxa_* symbols (same class as nitro#747).
 * Idempotent — runs on postinstall.
 */

const fs = require('fs');
const path = require('path');

function patchIfNeeded(absPath, label, apply) {
  if (!fs.existsSync(absPath)) {
    return;
  }
  const src = fs.readFileSync(absPath, 'utf8');
  const next = apply(src);
  if (next !== src) {
    fs.writeFileSync(absPath, next, 'utf8');
    console.log(`[patch-android-libcxx] ${label}`);
  }
}

const root = path.join(__dirname, '..', 'node_modules');

// react-native-nitro-modules
patchIfNeeded(
  path.join(root, 'react-native-nitro-modules', 'android', 'CMakeLists.txt'),
  'react-native-nitro-modules/android/CMakeLists.txt',
  (src) => {
    if (src.includes('find_library(CPP_SHARED_LIB c++_shared)') && src.includes('${CPP_SHARED_LIB}')) {
      return src;
    }
    const n1 = `find_library(LOG_LIB log)
find_package(fbjni REQUIRED NitroConfig)`;
    if (!src.includes(n1)) return src;
    let out = src.replace(
      n1,
      `find_library(LOG_LIB log)
find_library(CPP_SHARED_LIB c++_shared)
find_package(fbjni REQUIRED NitroConfig)`
    );
    const n2 = `        ReactAndroid::jsi                         # <-- RN: JSI
)`;
    if (!out.includes(n2)) return src;
    return out.replace(
      n2,
      `        ReactAndroid::jsi                         # <-- RN: JSI
        \${CPP_SHARED_LIB}                         # <-- LLVM libc++
)`
    );
  }
);

// expo-modules-core
patchIfNeeded(
  path.join(root, 'expo-modules-core', 'android', 'CMakeLists.txt'),
  'expo-modules-core/android/CMakeLists.txt',
  (src) => {
    if (src.includes('find_library(CPP_SHARED_LIB c++_shared)') && src.includes('\n  ${CPP_SHARED_LIB}\n')) {
      return src;
    }
    const n1 = `find_library(LOG_LIB log)

find_package(ReactAndroid REQUIRED CONFIG)`;
    if (!src.includes(n1)) return src;
    let out = src.replace(
      n1,
      `find_library(LOG_LIB log)
find_library(CPP_SHARED_LIB c++_shared)

find_package(ReactAndroid REQUIRED CONFIG)`
    );
    const n2 =
      'target_link_libraries(\n' +
      '  ${PACKAGE_NAME}\n' +
      '  CommonSettings\n' +
      '  ${LOG_LIB}\n' +
      '  fbjni::fbjni';
    if (!out.includes(n2)) return src;
    return out.replace(
      n2,
      'target_link_libraries(\n' +
        '  ${PACKAGE_NAME}\n' +
        '  CommonSettings\n' +
        '  ${LOG_LIB}\n' +
        '  ${CPP_SHARED_LIB}\n' +
        '  fbjni::fbjni'
    );
  }
);

// react-native-worklets
patchIfNeeded(
  path.join(root, 'react-native-worklets', 'android', 'CMakeLists.txt'),
  'react-native-worklets/android/CMakeLists.txt',
  (src) => {
    if (src.includes('find_library(CPP_SHARED_LIB c++_shared)') && src.includes('${CPP_SHARED_LIB}')) {
      return src;
    }
    const n1 = `find_package(ReactAndroid REQUIRED CONFIG)

if(\${JS_RUNTIME} STREQUAL "hermes")`;
    if (!src.includes(n1)) return src;
    let out = src.replace(
      n1,
      `find_package(ReactAndroid REQUIRED CONFIG)
find_library(CPP_SHARED_LIB c++_shared)

if(\${JS_RUNTIME} STREQUAL "hermes")`
    );
    const n2 = 'target_link_libraries(worklets log ReactAndroid::jsi fbjni::fbjni)';
    if (!out.includes(n2)) return src;
    return out.replace(
      n2,
      'target_link_libraries(worklets log ${CPP_SHARED_LIB} ReactAndroid::jsi fbjni::fbjni)'
    );
  }
);

// react-native-reanimated
patchIfNeeded(
  path.join(root, 'react-native-reanimated', 'android', 'CMakeLists.txt'),
  'react-native-reanimated/android/CMakeLists.txt',
  (src) => {
    if (
      src.includes('find_library(CPP_SHARED_LIB c++_shared)') &&
      src.includes('reanimated log ${CPP_SHARED_LIB}')
    ) {
      return src;
    }
    const n1 = `find_package(ReactAndroid REQUIRED CONFIG)

add_library(reanimated SHARED`;
    if (!src.includes(n1)) return src;
    let out = src.replace(
      n1,
      `find_package(ReactAndroid REQUIRED CONFIG)
find_library(CPP_SHARED_LIB c++_shared)

add_library(reanimated SHARED`
    );
    const n2 =
      'target_link_libraries(reanimated log ReactAndroid::jsi fbjni::fbjni android\n' +
      '                      worklets)';
    if (!out.includes(n2)) return src;
    return out.replace(
      n2,
      'target_link_libraries(reanimated log ${CPP_SHARED_LIB} ReactAndroid::jsi fbjni::fbjni android\n' +
        '                      worklets)'
    );
  }
);

// react-native app CMake: autolinked react_codegen_* shared libs need explicit libc++ (NDK 27 + lld).
patchIfNeeded(
  path.join(root, 'react-native', 'ReactAndroid', 'cmake-utils', 'ReactNative-application.cmake'),
  'react-native/ReactAndroid/cmake-utils/ReactNative-application.cmake',
  (src) => {
    if (
      src.includes('find_library(CPP_SHARED_LIB c++_shared)') &&
      src.includes('reactnative                         # prefab ready\n        ${CPP_SHARED_LIB}') &&
      src.includes('target_link_libraries(${autolinked_library} common_flags ${CPP_SHARED_LIB})')
    ) {
      return src;
    }
    let out = src;
    const injectFind = `add_library(fbjni ALIAS fbjni::fbjni)

target_link_libraries(\${CMAKE_PROJECT_NAME}`;
    if (!out.includes(injectFind)) return src;
    out = out.replace(
      `add_library(fbjni ALIAS fbjni::fbjni)

target_link_libraries(\${CMAKE_PROJECT_NAME}`,
      `add_library(fbjni ALIAS fbjni::fbjni)
find_library(CPP_SHARED_LIB c++_shared)

target_link_libraries(\${CMAKE_PROJECT_NAME}`
    );
    const appLink =
      '        reactnative                         # prefab ready\n)';
    if (!out.includes(appLink)) return src;
    out = out.replace(
      appLink,
      '        reactnative                         # prefab ready\n        ${CPP_SHARED_LIB}\n)'
    );
    const foreachOld =
      '            target_link_libraries(${autolinked_library} common_flags)\n        endforeach()';
    if (out.includes(foreachOld)) {
      out = out.replace(
        foreachOld,
        '            target_link_libraries(${autolinked_library} common_flags ${CPP_SHARED_LIB})\n        endforeach()'
      );
    }
    const codegenOld = '        target_link_libraries(${APP_CODEGEN_TARGET} common_flags)';
    if (out.includes(codegenOld)) {
      out = out.replace(
        codegenOld,
        '        target_link_libraries(${APP_CODEGEN_TARGET} common_flags ${CPP_SHARED_LIB})'
      );
    }
    return out;
  }
);

// react-native-gesture-handler (jni adapter .so)
patchIfNeeded(
  path.join(root, 'react-native-gesture-handler', 'android', 'src', 'main', 'jni', 'CMakeLists.txt'),
  'react-native-gesture-handler/android/src/main/jni/CMakeLists.txt',
  (src) => {
    if (
      src.includes('find_library(CPP_SHARED_LIB c++_shared)') &&
      src.includes('fbjni::fbjni\n  ${CPP_SHARED_LIB}')
    ) {
      return src;
    }
    const n1 = `find_package(fbjni REQUIRED CONFIG)

target_link_libraries(
  \${PACKAGE_NAME}
  ReactAndroid::reactnative`;
    if (!src.includes(n1)) return src;
    return src.replace(
      n1,
      `find_package(fbjni REQUIRED CONFIG)
find_library(CPP_SHARED_LIB c++_shared)

target_link_libraries(
  \${PACKAGE_NAME}
  ReactAndroid::reactnative`
    ).replace(
      `  fbjni::fbjni
)`,
      `  fbjni::fbjni
  \${CPP_SHARED_LIB}
)`
    );
  }
);

// react-native-safe-area-context (Fabric codegen .so in library project)
patchIfNeeded(
  path.join(root, 'react-native-safe-area-context', 'android', 'src', 'main', 'jni', 'CMakeLists.txt'),
  'react-native-safe-area-context/android/src/main/jni/CMakeLists.txt',
  (src) => {
    if (
      src.includes('find_library(CPP_SHARED_LIB c++_shared)') &&
      src.includes('reactnative\n          ${CPP_SHARED_LIB}')
    ) {
      return src;
    }
    const anchor = `# https://github.com/react-native-community/discussions-and-proposals/discussions/816`;
    if (!src.includes(anchor)) return src;
    let out = src.replace(
      anchor,
      `find_library(CPP_SHARED_LIB c++_shared)

${anchor}`
    );
    const merged =
      '  target_link_libraries(\n          ${LIB_TARGET_NAME}\n          fbjni\n          jsi\n          reactnative\n  )';
    if (!out.includes(merged)) return src;
    out = out.replace(
      merged,
      '  target_link_libraries(\n          ${LIB_TARGET_NAME}\n          fbjni\n          jsi\n          reactnative\n          ${CPP_SHARED_LIB}\n  )'
    );
    const legacy =
      '          yoga\n  )\nendif()';
    if (!out.includes(legacy)) return src;
    return out.replace(
      legacy,
      '          yoga\n          ${CPP_SHARED_LIB}\n  )\nendif()'
    );
  }
);

// react-native-screens (top-level jni adapter librnscreens.so, distinct from Fabric codegen)
patchIfNeeded(
  path.join(root, 'react-native-screens', 'android', 'CMakeLists.txt'),
  'react-native-screens/android/CMakeLists.txt',
  (src) => {
    if (
      src.includes('find_library(CPP_SHARED_LIB c++_shared)') &&
      src.includes('fbjni::fbjni\n            ${CPP_SHARED_LIB}\n            android')
    ) {
      return src;
    }
    const n1 = `find_package(ReactAndroid REQUIRED CONFIG)

if(\${RNS_NEW_ARCH_ENABLED})`;
    if (!src.includes(n1)) return src;
    let out = src.replace(
      n1,
      `find_package(ReactAndroid REQUIRED CONFIG)
find_library(CPP_SHARED_LIB c++_shared)

if(\${RNS_NEW_ARCH_ENABLED})`
    );
    const link76 =
      '            fbjni::fbjni\n            android\n        )\n    else()';
    if (!out.includes(link76)) return src;
    out = out.replace(
      link76,
      '            fbjni::fbjni\n            ${CPP_SHARED_LIB}\n            android\n        )\n    else()'
    );
    const linkLegacy =
      '                fbjni::fbjni\n                android\n        )\n    endif()';
    if (!out.includes(linkLegacy)) return src;
    out = out.replace(
      linkLegacy,
      '                fbjni::fbjni\n                ${CPP_SHARED_LIB}\n                android\n        )\n    endif()'
    );
    const linkOldArch =
      '    target_link_libraries(rnscreens\n        ReactAndroid::jsi\n        android\n    )\nendif()';
    if (!out.includes(linkOldArch)) return src;
    return out.replace(
      linkOldArch,
      '    target_link_libraries(rnscreens\n        ReactAndroid::jsi\n        ${CPP_SHARED_LIB}\n        android\n    )\nendif()'
    );
  }
);

// react-native-screens (Fabric codegen .so in library project)
patchIfNeeded(
  path.join(root, 'react-native-screens', 'android', 'src', 'main', 'jni', 'CMakeLists.txt'),
  'react-native-screens/android/src/main/jni/CMakeLists.txt',
  (src) => {
    if (
      src.includes('find_library(CPP_SHARED_LIB c++_shared)') &&
      src.includes('fbjni::fbjni\n    ${CPP_SHARED_LIB}')
    ) {
      return src;
    }
    const anchor = 'if(ReactAndroid_VERSION_MINOR GREATER_EQUAL 76)';
    if (!src.includes(anchor)) return src;
    let out = src.replace(
      anchor,
      `find_library(CPP_SHARED_LIB c++_shared)

${anchor}`
    );
    const merged =
      '    ReactAndroid::reactnative\n    ReactAndroid::jsi\n    fbjni::fbjni\n  )';
    if (!out.includes(merged)) return src;
    out = out.replace(
      merged,
      '    ReactAndroid::reactnative\n    ReactAndroid::jsi\n    fbjni::fbjni\n    ${CPP_SHARED_LIB}\n  )'
    );
    const legacyEnd = '    yoga\n  )\nendif()';
    if (!out.includes(legacyEnd)) return src;
    return out.replace(
      legacyEnd,
      '    yoga\n    ${CPP_SHARED_LIB}\n  )\nendif()'
    );
  }
);

// react-native-iap (Nitro hybrid module .so)
patchIfNeeded(
  path.join(root, 'react-native-iap', 'android', 'CMakeLists.txt'),
  'react-native-iap/android/CMakeLists.txt',
  (src) => {
    if (
      src.includes('find_library(CPP_SHARED_LIB c++_shared)') &&
      src.includes('${LOG_LIB}\n        ${CPP_SHARED_LIB}')
    ) {
      return src;
    }
    const n1 = `find_library(LOG_LIB log)

# Link all libraries together`;
    if (!src.includes(n1)) return src;
    let out = src.replace(
      n1,
      `find_library(LOG_LIB log)
find_library(CPP_SHARED_LIB c++_shared)

# Link all libraries together`
    );
    const n2 =
      'target_link_libraries(\n        ${PACKAGE_NAME}\n        ${LOG_LIB}\n        android                                   # <-- Android core\n)';
    if (!out.includes(n2)) return src;
    return out.replace(
      n2,
      'target_link_libraries(\n        ${PACKAGE_NAME}\n        ${LOG_LIB}\n        ${CPP_SHARED_LIB}\n        android                                   # <-- Android core\n)'
    );
  }
);

// expo-av (JNI shared library)
patchIfNeeded(
  path.join(root, 'expo-av', 'android', 'CMakeLists.txt'),
  'expo-av/android/CMakeLists.txt',
  (src) => {
    if (
      src.includes('find_library(CPP_SHARED_LIB c++_shared)') &&
      src.includes('${LOG_LIB}\n        ${CPP_SHARED_LIB}\n        fbjni::fbjni')
    ) {
      return src;
    }
    const n1 = `find_library(LOG_LIB log)

find_package(ReactAndroid REQUIRED CONFIG)`;
    if (!src.includes(n1)) return src;
    let out = src.replace(
      n1,
      `find_library(LOG_LIB log)
find_library(CPP_SHARED_LIB c++_shared)

find_package(ReactAndroid REQUIRED CONFIG)`
    );
    const n2 =
      'target_link_libraries(\n        ${PACKAGE_NAME}\n        ${LOG_LIB}\n        fbjni::fbjni\n        ReactAndroid::jsi\n        android\n)';
    if (!out.includes(n2)) return src;
    return out.replace(
      n2,
      'target_link_libraries(\n        ${PACKAGE_NAME}\n        ${LOG_LIB}\n        ${CPP_SHARED_LIB}\n        fbjni::fbjni\n        ReactAndroid::jsi\n        android\n)'
    );
  }
);
