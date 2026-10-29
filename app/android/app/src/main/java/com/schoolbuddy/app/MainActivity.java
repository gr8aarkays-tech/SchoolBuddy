package com.schoolbuddy.app;

import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import java.util.HashMap;
import java.util.Map;

/**
 * AiClass main activity.
 *
 * We override the Capacitor WebView's shouldInterceptRequest to inject the two
 * HTTP headers that Chrome requires for SharedArrayBuffer (used by WebLLM
 * for multi-threaded WASM inference):
 *
 *   Cross-Origin-Opener-Policy:   same-origin
 *   Cross-Origin-Embedder-Policy: require-corp
 *
 * Without these, navigator.gpu and SharedArrayBuffer are blocked by the browser
 * even on Android Chrome 121+.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Inject COOP/COEP headers so that SharedArrayBuffer and WebGPU
        // remain available inside the Capacitor WebView.
        getBridge().getWebView().setWebViewClient(new com.getcapacitor.BridgeWebViewClient(getBridge()) {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                WebResourceResponse response = super.shouldInterceptRequest(view, request);
                if (response != null && response.getResponseHeaders() != null) {
                    Map<String, String> headers = new HashMap<>(response.getResponseHeaders());
                    headers.put("Cross-Origin-Opener-Policy", "same-origin");
                    headers.put("Cross-Origin-Embedder-Policy", "require-corp");
                    response.setResponseHeaders(headers);
                }
                return response;
            }
        });
    }
}
