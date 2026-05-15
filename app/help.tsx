import { Redirect } from 'expo-router';

/** Old path `/help` → nested under settings. */
export default function HelpRedirect() {
  return <Redirect href="/settings/help" />;
}
