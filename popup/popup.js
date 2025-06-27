document.addEventListener('DOMContentLoaded', initPopup);

const SPLASH_SCREEN_ID = 'splashScreen';
const SETTINGS_SCREEN_ID = 'settingsScreen';
const API_PROVIDER_ID = 'apiProvider';
const AI_MODEL_ID = 'aiModel';
const API_ENDPOINT_ID = 'apiEndpoint';
const CUSTOM_PROMPT_ID = 'customPrompt';
const API_KEY_ID = 'apiKey';
const STATUS_ELEMENT_ID = 'status'; // This might not be used directly anymore for toast, but keep it for reference
const SAVE_SETTINGS_BTN_ID = 'saveSettings';
const GO_TO_SETTINGS_BTN_ID = 'goToSettingsBtn';
const BACK_TO_SPLASH_BTN_ID = 'backToSplashBtn';
const CANCEL_SETTINGS_BTN_ID = 'cancelSettings';
const RESET_PROMPT_BTN_ID = 'resetPromptBtn';
const TOAST_CONTAINER_ID = 'toastContainer'; // New constant for toast container ID

// Supported AI Models
const AI_MODELS = {
  gemini: [
    { value: 'gemini-pro', text: 'Gemini Pro' },
    { value: 'gemini-2.5-flash-preview-05-20', text: 'Gemini 2.5 Flash (Preview)' },
    { value: 'gemini-2.5-flash-preview-tts', text: 'Gemini 2.5 Flash (Preview TTS)' },
    { value: 'gemini-2.5-pro-preview-06-05', text: 'Gemini 2.5 Pro (Preview)' },
    { value: 'gemini-2.5-pro-preview-tts', text: 'Gemini 2.5 Pro (Preview TTS)' },
    { value: 'gemini-2.0-flash', text: 'Gemini 2.0 Flash (Latest)' },
    { value: 'gemini-2.0-flash-lite', text: 'Gemini 2.0 Flash Lite (Latest)' },
    { value: 'gemini-1.5-flash', text: 'Gemini 1.5 Flash (Latest)' },
    { value: 'gemini-1.5-pro', text: 'Gemini 1.5 Pro (Latest)' },
  ],
  openai: [
    { value: 'gpt-3.5-turbo', text: 'GPT-3.5 Turbo' },
    { value: 'gpt-4', text: 'GPT-4' },
    { value: 'gpt-4o', text: 'GPT-4o' },
    { value: 'gpt-4-turbo', text: 'GPT-4 Turbo' },
  ],
};

// Default API Endpoints
const DEFAULT_ENDPOINTS = {
  gemini: 'https://generativelanguage.googleapis.com/v1beta/models/',
  openai: 'https://api.openai.com/v1/chat/completions',
};

const DEFAULT_TRANSLATION_PROMPT =
  'Detect the language of the following text, then translate it into Vietnamese, focusing on accuracy, technical terminology. Do not include any introductory or concluding phrases, just the translated text: "{text}"';

function initPopup() {
  document
    .getElementById(GO_TO_SETTINGS_BTN_ID)
    .addEventListener('click', () => switchView(SETTINGS_SCREEN_ID));
  document
    .getElementById(BACK_TO_SPLASH_BTN_ID)
    .addEventListener('click', () => switchView(SPLASH_SCREEN_ID));
  document
    .getElementById(SAVE_SETTINGS_BTN_ID)
    .addEventListener('click', saveSettings);
  document
    .getElementById(CANCEL_SETTINGS_BTN_ID)
    .addEventListener('click', cancelSettings);
  document
    .getElementById(RESET_PROMPT_BTN_ID)
    .addEventListener('click', resetPromptToDefault);
  document
    .getElementById(API_PROVIDER_ID)
    .addEventListener('change', updateModelAndEndpointDefaults);

  loadSettings();

  // Initialize the popup's view and height after all content is loaded and settings are applied
  const splashScreen = document.getElementById(SPLASH_SCREEN_ID);
  const container = document.querySelector('.container');

  // Temporarily make splashScreen visible and position it relatively to measure its height
  splashScreen.style.position = 'relative';
  splashScreen.style.visibility = 'hidden'; // Keep hidden visually
  splashScreen.classList.remove('hidden'); // Ensure it's not hidden by class for measurement

  // Use a small timeout to allow browser to render and calculate scrollHeight accurately
  setTimeout(() => {
    const initialHeight = splashScreen.scrollHeight; // No extra buffer
    container.style.height = `${initialHeight}px`;

    // Reset splashScreen to its initial hidden state after measurement
    splashScreen.style.position = 'absolute';
    splashScreen.style.visibility = 'visible'; // This will be overridden by .hidden
    splashScreen.classList.add('hidden'); // Re-hide it
    switchView(SPLASH_SCREEN_ID); // Then display the correct initial view
  }, 50); // Small delay
}

// Function to switch between views (splash screen and settings screen)
function switchView(viewId) {
  const splashScreen = document.getElementById(SPLASH_SCREEN_ID);
  const settingsScreen = document.getElementById(SETTINGS_SCREEN_ID);
  const container = document.querySelector('.container');

  let targetView;
  let currentView;

  if (viewId === SETTINGS_SCREEN_ID) {
    targetView = settingsScreen;
    currentView = splashScreen;
    loadSettings(); // Load settings when switching to settings view
  } else {
    targetView = splashScreen;
    currentView = settingsScreen;
  }

  // Prepare target view for measurement
  targetView.style.position = 'relative';
  targetView.style.visibility = 'hidden'; // Keep visually hidden
  targetView.style.opacity = '0'; // Ensure it's not visible during measurement
  targetView.classList.remove('hidden'); // Temporarily remove hidden class for scrollHeight calculation

  // Allow browser to render the targetView in its temporary state
  requestAnimationFrame(() => {
    const targetHeight = targetView.scrollHeight; // No extra buffer

    // Adjust container height
    container.style.height = `${targetHeight}px`;

    // After height transition, switch classes for the slide animation
    // The timeout should match the container's height transition duration
    setTimeout(() => {
      currentView.classList.remove('active');
      currentView.classList.add('hidden');

      targetView.classList.remove('hidden');
      targetView.classList.add('active');

      // Reset targetView's position and visibility for the transition
      targetView.style.position = 'absolute';
      targetView.style.visibility = 'visible';
      targetView.style.opacity = '1';
    }, 300); // This timeout should match your CSS transition duration for transform/opacity
  });
}

// --- NEW: Function to remove a specific toast message ---
function removeToast(toastElement) {
  if (toastElement && toastElement.parentNode) {
    toastElement.classList.remove('show');
    toastElement.style.opacity = '0';
    toastElement.style.transform = 'translateY(-20px)'; // Slide up when disappearing
    setTimeout(() => {
      if (toastElement && toastElement.parentNode) {
        toastElement.parentNode.removeChild(toastElement);
      }
    }, 300); // Match CSS transition duration
  }
}

// Function to show status messages (toast)
function showStatus(message, isError = false) {
  let toastContainer = document.getElementById(TOAST_CONTAINER_ID);
  if (!toastContainer) {
    // Create toast container if it doesn't exist
    toastContainer = document.createElement('div');
    toastContainer.id = TOAST_CONTAINER_ID;
    document.body.appendChild(toastContainer);
  }

  const toastMessage = document.createElement('div');
  toastMessage.classList.add('toast-message');
  toastMessage.classList.add(isError ? 'error' : 'success');

  // Add the message text
  const messageText = document.createElement('span');
  messageText.textContent = message;
  toastMessage.appendChild(messageText);

  // Add the close button
  const closeButton = document.createElement('button');
  closeButton.classList.add('toast-close-btn');
  closeButton.innerHTML = '&times;'; // 'x' icon
  closeButton.title = 'Dismiss message';
  closeButton.addEventListener('click', () => removeToast(toastMessage)); // Attach click listener
  toastMessage.appendChild(closeButton);

  toastContainer.appendChild(toastMessage);

  requestAnimationFrame(() => {
    toastMessage.classList.add('show');
  });

  if (!isError) {
    setTimeout(() => removeToast(toastMessage), 3000);
  }
}

function loadSettings() {
  chrome.storage.sync.get(
    ['apiProvider', 'apiKey', 'apiEndpoint', 'aiModel', 'customPrompt'],
    function (items) {
      document.getElementById(API_PROVIDER_ID).value =
        items.apiProvider || 'gemini';
      document.getElementById(API_KEY_ID).value = items.apiKey || '';
      document.getElementById(API_ENDPOINT_ID).value =
        items.apiEndpoint || DEFAULT_ENDPOINTS['gemini'];
      document.getElementById(CUSTOM_PROMPT_ID).value =
        items.customPrompt || DEFAULT_TRANSLATION_PROMPT;

      updateModelAndEndpointDefaults();
      if (items.aiModel) {
        document.getElementById(AI_MODEL_ID).value = items.aiModel;
      } else {
        document.getElementById(AI_MODEL_ID).value =
          document.getElementById(AI_MODEL_ID).options[0]?.value || '';
      }
    }
  );
}

function saveSettings() {
  const apiProvider = document.getElementById(API_PROVIDER_ID).value;
  const apiKey = document.getElementById(API_KEY_ID).value;
  const apiEndpoint = document.getElementById(API_ENDPOINT_ID).value;
  const aiModel = document.getElementById(AI_MODEL_ID).value;
  const customPrompt = document.getElementById(CUSTOM_PROMPT_ID).value;

  chrome.storage.sync.set(
    {
      apiProvider: apiProvider,
      apiKey: apiKey,
      apiEndpoint: apiEndpoint,
      aiModel: aiModel,
      customPrompt: customPrompt,
    },
    function () {
      if (chrome.runtime.lastError) {
        showStatus(
          'Error saving settings: ' + chrome.runtime.lastError.message,
          true
        );
      } else {
        showStatus('Settings saved successfully!');
      }
    }
  );
}

function updateModelAndEndpointDefaults() {
  const provider = document.getElementById(API_PROVIDER_ID).value;
  const aiModelSelect = document.getElementById(AI_MODEL_ID);
  const apiEndpointInput = document.getElementById(API_ENDPOINT_ID);

  aiModelSelect.innerHTML = '';

  const models = AI_MODELS[provider] || [];
  models.forEach((model) => {
    const option = document.createElement('option');
    option.value = model.value;
    option.textContent = model.text;
    aiModelSelect.appendChild(option);
  });

  const currentEndpointValue = apiEndpointInput.value;
  const defaultEndpoint = DEFAULT_ENDPOINTS[provider];

  if (
    currentEndpointValue === '' ||
    (provider === 'gemini' && currentEndpointValue.includes('openai.com')) ||
    (provider === 'openai' && currentEndpointValue.includes('googleapis.com'))
  ) {
    apiEndpointInput.value = defaultEndpoint;
  }

  aiModelSelect.value = aiModelSelect.options[0]?.value || '';
}

function cancelSettings() {
  loadSettings();
  showStatus('Changes discarded.', false);
  switchView(SPLASH_SCREEN_ID);
}

function resetPromptToDefault() {
  document.getElementById(CUSTOM_PROMPT_ID).value = DEFAULT_TRANSLATION_PROMPT;
  showStatus('Prompt reset to default.', false);
}
