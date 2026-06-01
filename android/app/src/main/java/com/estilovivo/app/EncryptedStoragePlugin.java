package com.estilovivo.app;

import android.content.Context;
import android.content.SharedPreferences;
import androidx.annotation.NonNull;
import androidx.security.crypto.EncryptedSharedPreferences;
import androidx.security.crypto.MasterKey;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.IOException;
import java.security.GeneralSecurityException;

@CapacitorPlugin(name = "EncryptedStorage")
public class EncryptedStoragePlugin extends Plugin {
    private static final String PREFS_FILE = "encrypted_storage";
    private SharedPreferences sharedPreferences;

    private SharedPreferences getSecurePreferences() throws GeneralSecurityException, IOException {
        if (sharedPreferences == null) {
            Context context = getContext();
            MasterKey masterKey = new MasterKey.Builder(context)
                    .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                    .build();

            sharedPreferences = EncryptedSharedPreferences.create(
                    context,
                    PREFS_FILE,
                    masterKey,
                    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            );
        }
        return sharedPreferences;
    }

    @PluginMethod
    public void setItem(PluginCall call) {
        String key = call.getString("key");
        String value = call.getString("value");
        if (key == null || value == null) {
            call.reject("Missing key or value");
            return;
        }

        try {
            getSecurePreferences().edit().putString(key, value).apply();
            call.resolve();
        } catch (GeneralSecurityException | IOException e) {
            call.reject("Failed to save secure item", e);
        }
    }

    @PluginMethod
    public void getItem(PluginCall call) {
        String key = call.getString("key");
        if (key == null) {
            call.reject("Missing key");
            return;
        }

        try {
            String value = getSecurePreferences().getString(key, null);
            JSObject result = new JSObject();
            result.put("value", value);
            call.resolve(result);
        } catch (GeneralSecurityException | IOException e) {
            call.reject("Failed to load secure item", e);
        }
    }

    @PluginMethod
    public void removeItem(PluginCall call) {
        String key = call.getString("key");
        if (key == null) {
            call.reject("Missing key");
            return;
        }

        try {
            getSecurePreferences().edit().remove(key).apply();
            call.resolve();
        } catch (GeneralSecurityException | IOException e) {
            call.reject("Failed to remove secure item", e);
        }
    }

    @PluginMethod
    public void clear(PluginCall call) {
        try {
            getSecurePreferences().edit().clear().apply();
            call.resolve();
        } catch (GeneralSecurityException | IOException e) {
            call.reject("Failed to clear secure storage", e);
        }
    }
}
