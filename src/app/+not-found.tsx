import { Redirect } from 'expo-router';

/** Unknown links (e.g. an old shared URL) go to the charger map. */
export default function NotFound() {
  return <Redirect href="/" />;
}
