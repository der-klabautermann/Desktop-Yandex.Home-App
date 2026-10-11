// Должен импортироваться первым: модули приложения читают window.api при загрузке.
import { installMockApi } from './mockApi';
import { IS_DEMO } from './demo';

// В разработке без Electron и в демо-сборке интерфейс работает на демо-данных
if ((import.meta.env.DEV && !(window as any).api) || IS_DEMO) {
  installMockApi();
}
