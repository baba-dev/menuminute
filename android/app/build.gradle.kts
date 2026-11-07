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

    // CI creates unsigned bundles. Only a manual, credentialed release can sign.
    // The signed bundle must use the Play Console upload certificate.
    signingConfigs {
        val storePath = System.getenv("MM_ANDROID_UPLOAD_STORE")
        val storePass = System.getenv("MM_ANDROID_UPLOAD_STORE_PASSWORD")
        val alias = System.getenv("MM_ANDROID_UPLOAD_KEY_ALIAS")
        val keyPass = System.getenv("MM_ANDROID_UPLOAD_KEY_PASSWORD")
        if (!storePath.isNullOrBlank() && !storePass.isNullOrBlank() &&
            !alias.isNullOrBlank() && !keyPass.isNullOrBlank()) {
            create("upload") {
                storeFile = file(storePath)
                storePassword = storePass
                keyAlias = alias
                keyPassword = keyPass
            }
        }
    }

    buildTypes {
        getByName("release") {
            isMinifyEnabled = false
            signingConfig = signingConfigs.findByName("upload")
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
