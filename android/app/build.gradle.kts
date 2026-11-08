plugins {
    id("com.android.application")
}

// Local/unsigned builds keep the original v1 identity. Each signed release
// supplies its own immutable version through the protected GitHub workflow.
val suppliedCode = System.getenv("MM_ANDROID_VERSION_CODE")
val playVersionCode = suppliedCode?.toIntOrNull() ?: if (suppliedCode == null) 1
    else error("MM_ANDROID_VERSION_CODE must be a valid integer")
require(playVersionCode in 1..2_100_000_000) {
    "Android versionCode exceeds the supported Google Play range"
}

val playVersionName = System.getenv("MM_ANDROID_VERSION_NAME") ?: "1.0.0"
require(playVersionName.matches(Regex("[0-9]+\\.[0-9]+\\.[0-9]+"))) {
    "MM_ANDROID_VERSION_NAME must have numeric major.minor.patch components"
}

android {
    namespace = "com.bababuilds.menuminute"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.bababuilds.menuminute"
        minSdk = 26
        targetSdk = 36
        versionCode = playVersionCode
        versionName = playVersionName
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
    // Digital Goods API bridge to Google Play Billing (billing 1.2.0 = Play Billing Library 8.3.0, which
    // Google Play requires for app updates after 2026-08-31). The web app never loads a billing SDK; it
    // only calls navigator Digital Goods / PaymentRequest, and the server verifies every purchase.
    implementation("com.google.androidbrowserhelper:billing:1.2.0")
}
