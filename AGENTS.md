# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

# GrapheneOS: INSTALL_BASELINE_PROFILE_FAILED

Installing/running this app on GrapheneOS fails with:

```
Error running 'app'
The application could not be installed: INSTALL_BASELINE_PROFILE_FAILED Installation failed due to: 'Baseline profile did not install: [com.ospfranco.opsqlitetest]
path: /data/app/.../base.apk
arm64: [status=speed] [reason=install-dm] [primary-abi]
[location is /data/app/.../oat/arm64/base.odex]
'
```

Root cause: AGP auto-merges every dependency's `baseline-prof.txt` (React
Native, AndroidX, Jetpack Compose, etc. all ship one — ~77 of them in this
project's dependency tree) into a compiled ART profile at
`assets/dexopt/baseline.prof`/`.profm` and bakes it into the APK. On
install, AGP's deployer pushes this profile alongside the APK as a `.dm`
(dex metadata) sidecar (`reason=install-dm` in the error above) — this
happens for Android Studio's "Run" deployment specifically, independent of
whether the profile is present in the APK's packaged assets. GrapheneOS
hardens ART's baseline profile installation and rejects it outright, which
fails the whole install — the app never launches.

**The actual fix** (confirmed working) is in `android/app/build.gradle`,
inside the top-level `android { }` block — not nested in `buildTypes`,
which doesn't have this property and fails Gradle sync:

```groovy
android {
    installation {
        enableBaselineProfile = false
    }
}
```

`enableBaselineProfile` lives on `ApplicationExtension.installation`
(`com.android.build.api.dsl.ApplicationInstallation`), verified against the
resolved AGP version's actual DSL classes (this project resolves AGP
8.12.0 despite an unrelated `com.android.tools.build:gradle` classpath
entry that might suggest otherwise — check
`android/app/build/intermediates/default_proguard_files/.../proguard-android.txt-<version>`
if the AGP version is ever in doubt, since multiple AGP versions are
typically present in the Gradle cache and it's easy to check the wrong
one). This stops AGP's deployer from attempting the `.dm` push at
install time at all, which is what GrapheneOS was rejecting.

Two more changes are also present as defense in depth, but neither one
alone was sufficient — the `installation` block above is what actually
fixed the install failure:
1. `configurations.all { exclude group: 'androidx.profileinstaller', module: 'profileinstaller' }` — stops the *separate* runtime-profile mechanism (a startup `Initializer` + broadcast receiver that writes profiles after launch) from registering. This alone did not fix `INSTALL_BASELINE_PROFILE_FAILED`, since that error happens at install time, before the app (and thus this runtime code) ever runs.
2. `packagingOptions.resources.excludes` for `assets/dexopt/baseline.prof`/`.profm` — strips the baked-in profile from the APK's packaged assets. This alone also did not fix the error, since AGP's Studio-deploy DM push is driven by the compiled profile in `build/intermediates/`, not by what ends up zipped into the final APK.
