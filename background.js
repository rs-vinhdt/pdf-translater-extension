function setupRules() {
  const viewerUrl = chrome.runtime.getURL('web/viewer.html');
  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [1],
    addRules: [{
      id: 1, priority: 1,
      action: { type: 'redirect', redirect: { regexSubstitution: `${viewerUrl}?file=\\1` } },
      condition: { regexFilter: '^(https?://.*\\.pdf(\\?.*)?|file://.*\\.pdf)$', resourceTypes: ['main_frame'] }
    }]
  });
}

chrome.runtime.onInstalled.addListener(() => {
  setupRules();
});


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "PROCESS_TEXT_REQUEST") {
    handleApiCall(request.text, sender.tab.id);
    // Return true to indicate that the response will be sent asynchronously.
    // While we don't use sendResponse here, it's good practice.
    return true;
  }
});

async function handleApiCall(textToTranslate, tabId) {
  try {
    // Get user settings from storage. Provide sensible defaults.
    const settings = await getExtensionSettings();
    const { apiProvider, apiKey, apiEndpoint, aiModel, customPrompt } = settings;

    if (!apiKey) {
      throw new Error(
        'API Key is not set in extension settings. Please go to the extension popup to set it.'
      );
    }
    if (!aiModel) {
      throw new Error(
        'AI Model is not selected in extension settings. Please select one.'
      );
    }
    if (!apiEndpoint) {
      throw new Error(
        'API Endpoint is not set in extension settings. Please set it.'
      );
    }

    // --- Prepare the API request based on the provider ---
    let requestUrl = apiEndpoint;
    let headers = {
      'Content-Type': 'application/json',
    };
    let body = {};

    const prompt = customPrompt.replace(/{text}/g, textToTranslate); // Replace {text} placeholder

    if (apiProvider === 'gemini') {
      if (!apiEndpoint.includes(`models/${aiModel}`)) {
        // Append model and generateContent if not already part of the endpoint
        if (apiEndpoint.endsWith('/')) {
          // If endpoint ends with a slash (e.g., .../models/)
          requestUrl = `${apiEndpoint}${aiModel}:generateContent`;
        } else if (apiEndpoint.includes('models')) {
          // If endpoint has models but no trailing slash (e.g., .../models)
          requestUrl = `${apiEndpoint}/${aiModel}:generateContent`;
        } else {
          // Generic case, might be just the base URL
          requestUrl = `${apiEndpoint}models/${aiModel}:generateContent`;
        }
      } else if (!apiEndpoint.endsWith(':generateContent')) {
        // If model is already in path but :generateContent is missing
        requestUrl = `${apiEndpoint}:generateContent`;
      }
      headers['x-goog-api-key'] = apiKey;
      body = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
        },
      };
    } else if (apiProvider === 'openai') {
      // For OpenAI, model is in the body, endpoint is usually fixed
      headers['Authorization'] = `Bearer ${apiKey}`;
      body = {
        model: aiModel,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
      };
    } else {
      throw new Error(`Unsupported API Provider: ${settings.apiProvider}`);
    }

    // --- Make the API call using fetch ---
    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorBody = await response.json();
      throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorBody.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();

    // --- Extract the translated text from the response ---
    let translatedText = '';
    if (apiProvider === 'gemini') {
      if (
        data.candidates &&
        data.candidates.length > 0 &&
        data.candidates[0].content &&
        data.candidates[0].content.parts &&
        data.candidates[0].content.parts.length > 0
      ) {
        translatedText = data.candidates[0].content.parts[0].text;
      } else {
        throw new Error(
          'Gemini API: No translation found in response or unexpected format.'
        );
      }
    } else if (apiProvider === 'openai') {
      if (
        data.choices &&
        data.choices.length > 0 &&
        data.choices[0].message &&
        data.choices[0].message.content
      ) {
        translatedText = data.choices[0].message.content;
      } else {
        throw new Error(
          'OpenAI API: No translation found in response or unexpected format.'
        );
      }
    }

    if (!translatedText) {
      throw new Error("No translation found in the API response.");
    }

    // --- Send the successful result back to the viewer ---
    chrome.tabs.sendMessage(tabId, {
      type: "SHOW_PROCESSED_RESULT",
      text: translatedText
    });

  } catch (error) {
    console.error("Translation Error:", error);
    // --- Send an error message back to the viewer ---
    chrome.tabs.sendMessage(tabId, {
      type: "SHOW_PROCESSED_RESULT",
      text: `Error: ${error.message}` // Send the error message to be displayed in the tooltip
    });
  }
}

async function getExtensionSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      ['apiProvider', 'apiKey', 'apiEndpoint', 'aiModel', 'customPrompt'],
      function (items) {
        resolve(items);
      }
    );
  });
}
