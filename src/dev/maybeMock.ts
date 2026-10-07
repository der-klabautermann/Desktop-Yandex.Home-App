// Должен импортироваться первым: модули приложения читают window.api при загрузке.
import { installMockApi } from './mockApi';

if (import.meta.env.DEV && !(window as any).api) {
  installMockApi();
}
