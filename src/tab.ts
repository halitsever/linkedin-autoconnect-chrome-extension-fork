import { createPubSub } from "create-pubsub";
import randomInt from "random-int";
import {
  LinkedInCssSelector,
  LinkedInPage,
  LinkedInUrl,
  MessageId,
  delay,
  emitChromePortConnected,
  getChromePort,
  getMaximumAutoConnectionsPerSession,
  loadOptions,
  onChromePortConnected,
  onChromePortMessageReceived,
  postChromePortMessage,
  startListeningToChromePortMessages,
} from "./shared";

const maximumAttemptsForFindingHtmlElements = 5;
const minimumDelayBetweenConnectClicks = 1500;
const maximumDelayBetweenConnectClicks = 3000;
const oneSecondIntervalInMilliseconds = 1000;
const halfSecondIntervalInMilliseconds = 500;
const [emitNextAvailableConnectButtonFound, onNextAvailableConnectButtonFound] = createPubSub<HTMLElement>();
const [emitNextAvailableConnectButtonNotFound, onNextAvailableConnectButtonNotFound] = createPubSub();
const [emitConnectButtonClicked, onConnectButtonClicked] = createPubSub();
const [emitOneSecondIntervalTicked, onOneSecondIntervalTicked] = createPubSub();
const [emitStarted, onStarted] = createPubSub();
const [emitStopped, onStopped] = createPubSub();
const [emitWindowLocationUpdated, onWindowLocationUpdated, getLastWindowLocation] = createPubSub("");
const [emitSearchPageLoaded, onSearchPageLoaded] = createPubSub();
const [emitMyNetworkPageLoaded, onMyNetworkPageLoaded] = createPubSub();
const [emitUnidentifiedPageLoaded, onUnidentifiedPageLoaded] = createPubSub();
const [emitButtonClicksCount, onButtonClicksCountUpdated, getButtonClicksCount] = createPubSub(0);
const [emitCurrentLinkedInPage, , getCurrentLinkedInPage] = createPubSub(LinkedInPage.Unidentified);
const [emitIsRunning, onIsRunningUpdated, getIsRunning] = createPubSub(false);

function focusAndClickElement(element: HTMLElement) {
  element.focus();
  element.click();
}

function queryWithShadow<T extends HTMLElement>(selector: string, root: Document | ShadowRoot = document): T | null {
  const direct = root.querySelector<T>(selector);
  if (direct) return direct;

  for (const host of Array.from(root.querySelectorAll("*"))) {
    if (host.shadowRoot) {
      const found = queryWithShadow<T>(selector, host.shadowRoot);
      if (found) return found;
    }
  }

  return null;
}

function clickConnectButton(button: HTMLElement) {
  focusAndClickElement(button);
  button.setAttribute("data-autoconnect-clicked", "true");
  emitConnectButtonClicked();
}

function confirmSendInviteModal() {
  const maxModalAttempts = 20;

  return new Promise<void>((resolve) => {
    let attempts = 0;

    const interval = setInterval(() => {
      const sendButton = queryWithShadow<HTMLButtonElement>(LinkedInCssSelector.SendButtonFromSendInviteModal);
      if (sendButton) {
        focusAndClickElement(sendButton);
        clearInterval(interval);
        resolve();
        return;
      }

      const closeSendInMailsModalButton = queryWithShadow(LinkedInCssSelector.CloseSendInMailsModalButton)?.parentElement;
      if (closeSendInMailsModalButton) {
        focusAndClickElement(closeSendInMailsModalButton);
      }

      const sendInMailsModalDismissButton = queryWithShadow<HTMLButtonElement>(
        LinkedInCssSelector.SendInMailsModalDismissButton
      );
      if (sendInMailsModalDismissButton) {
        focusAndClickElement(sendInMailsModalDismissButton);
      }

      if (
        closeSendInMailsModalButton ||
        sendInMailsModalDismissButton ||
        ++attempts > maxModalAttempts
      ) {
        clearInterval(interval);
        resolve();
      }
    }, halfSecondIntervalInMilliseconds);
  });
}

function findNextAvailableConnectButton(selector: LinkedInCssSelector) {
  let attempts = 0;

  const interval = setInterval(() => {
    window.scrollTo(0, document.body.scrollHeight);

    const nextAvailableConnectButton = queryWithShadow<HTMLElement>(selector);

    if (nextAvailableConnectButton) {
      clearInterval(interval);
      emitNextAvailableConnectButtonFound(nextAvailableConnectButton);
    } else if (++attempts > maximumAttemptsForFindingHtmlElements) {
      clearInterval(interval);
      emitNextAvailableConnectButtonNotFound();
    }
  }, halfSecondIntervalInMilliseconds);
}

function goToNextPage() {
  queryWithShadow<HTMLButtonElement>(LinkedInCssSelector.NextPageButton)?.click();
}

function startListeningToChromePortConnections() {
  return chrome.runtime.onConnect.addListener(emitChromePortConnected);
}

function startOneSecondIntervalTicker() {
  return setInterval(emitOneSecondIntervalTicked, oneSecondIntervalInMilliseconds);
}

function searchForConnectButtonIfRunning() {
  const isRunning = getIsRunning();
  const currentLinkedInPage = getCurrentLinkedInPage();
  if (isRunning && [LinkedInPage.MyNetwork, LinkedInPage.SearchPeople].includes(currentLinkedInPage)) {
    findNextAvailableConnectButton(
      currentLinkedInPage === LinkedInPage.MyNetwork
        ? LinkedInCssSelector.ConnectButtonFromMyNetworkPage
        : LinkedInCssSelector.ConnectButtonFromSearchPage
    );
  }
}

(async () => {
  onWindowLocationUpdated((windowLocation) => {
    if (windowLocation.includes(LinkedInUrl.PatternOfSearchPage)) {
      emitSearchPageLoaded();
    } else if (windowLocation.includes(LinkedInUrl.PatternOfMyNetworkPage)) {
      emitMyNetworkPageLoaded();
    } else {
      emitUnidentifiedPageLoaded();
    }
  });

  onStarted(() => emitIsRunning(true));

  onStopped(() => emitIsRunning(false));

  onUnidentifiedPageLoaded(() => emitIsRunning(false));

  onConnectButtonClicked(async () => {
    emitButtonClicksCount(getButtonClicksCount() + 1);
    await confirmSendInviteModal();
    await delay(randomInt(minimumDelayBetweenConnectClicks, maximumDelayBetweenConnectClicks));
    if (getIsRunning()) {
      if (getButtonClicksCount() >= Number(getMaximumAutoConnectionsPerSession())) {
        emitStopped();
      } else {
        searchForConnectButtonIfRunning();
      }
    }
  });

  onButtonClicksCountUpdated((buttonClicksCount) => {
    const port = getChromePort();
    if (port) {
      postChromePortMessage({ message: { id: MessageId.ButtonClicksCountUpdated, content: buttonClicksCount }, port });
    }
  });

  onChromePortConnected((port) => {
    postChromePortMessage({ message: { id: MessageId.RunningStateUpdated, content: getIsRunning() }, port });
    postChromePortMessage({
      message: { id: MessageId.ButtonClicksCountUpdated, content: getButtonClicksCount() },
      port,
    });
  });

  onChromePortMessageReceived(({ message }) => {
    switch (message.id) {
      case MessageId.StartAutoConnect:
        return emitStarted();
      case MessageId.StopAutoConnect:
        return emitStopped();
    }
  });

  onIsRunningUpdated((isRunning) => {
    const port = getChromePort();

    if (port) postChromePortMessage({ message: { id: MessageId.RunningStateUpdated, content: isRunning }, port });

    searchForConnectButtonIfRunning();
  });

  onOneSecondIntervalTicked(() => {
    if (window.location.href !== getLastWindowLocation()) emitWindowLocationUpdated(window.location.href);
  });

  onChromePortConnected((port) => {
    postChromePortMessage({ message: { id: MessageId.ConnectionEstablished }, port });
    startListeningToChromePortMessages(port);
  });

  onNextAvailableConnectButtonFound(clickConnectButton);

  onNextAvailableConnectButtonNotFound(goToNextPage);

  onMyNetworkPageLoaded(() => {
    emitCurrentLinkedInPage(LinkedInPage.MyNetwork);
    searchForConnectButtonIfRunning();
  });

  onSearchPageLoaded(() => {
    emitCurrentLinkedInPage(LinkedInPage.SearchPeople);
    searchForConnectButtonIfRunning();
  });

  await loadOptions();

  startListeningToChromePortConnections();

  startOneSecondIntervalTicker();
})();
