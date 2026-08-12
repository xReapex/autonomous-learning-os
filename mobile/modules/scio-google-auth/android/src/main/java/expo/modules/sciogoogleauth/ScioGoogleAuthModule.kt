package expo.modules.sciogoogleauth

import android.content.Context
import android.content.pm.PackageManager
import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ScioGoogleAuthModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("ScioGoogleAuth")

    Function("isConfigured") {
      configuredClientId() != null
    }

    AsyncFunction("requestIdToken") { nonce: String ->
      require(nonce.length in 32..128) { "social_nonce_invalid" }
      val serverClientId = configuredClientId()
        ?: throw IllegalStateException("social_auth_not_configured")

      val googleIdOption = GetGoogleIdOption.Builder()
        .setServerClientId(serverClientId)
        .setNonce(nonce)
        .setFilterByAuthorizedAccounts(false)
        .setAutoSelectEnabled(false)
        .build()
      val request = GetCredentialRequest.Builder()
        .addCredentialOption(googleIdOption)
        .build()

      try {
        val result = CredentialManager.create(context).getCredential(context, request)
        val credential = result.credential
        if (
          credential !is CustomCredential ||
          credential.type != GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
        ) {
          throw IllegalStateException("social_identity_invalid")
        }
        val googleCredential = GoogleIdTokenCredential.createFrom(credential.data)
        mapOf("type" to "success", "idToken" to googleCredential.idToken)
      } catch (_: GetCredentialCancellationException) {
        mapOf("type" to "cancelled")
      }
    }

    AsyncFunction("clearCredentialState") {
      CredentialManager.create(context).clearCredentialState(ClearCredentialStateRequest())
    }
  }

  private fun configuredClientId(): String? {
    val metadata = context.packageManager.getApplicationInfo(
      context.packageName,
      PackageManager.GET_META_DATA
    ).metaData
    return metadata?.getString("io.scio.auth.GOOGLE_SERVER_CLIENT_ID")?.trim()?.takeIf {
      it.matches(Regex("^[0-9A-Za-z-]+\\.apps\\.googleusercontent\\.com$"))
    }
  }
}
