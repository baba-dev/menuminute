plugins {
    id("com.android.application")
}

android {
    namespace = "com.bababuilds.menuminute"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.bababuilds.menuminute"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0"
    }

    buildTypes {
        getByName("release") {
            isMinifyEnabled = false
            // AABs are unsigned until a Play upload key is explicitly configured.
            // Never commit a signing key or a keystore password.
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    // Google's documented TWA helper: launcher, browser selection and verified origin.
    implementation("com.google.androidbrowserhelper:androidbrowserhelper:2.7.4")
}
