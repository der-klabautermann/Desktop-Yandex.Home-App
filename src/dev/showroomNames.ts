// Названия дома-выставки на английском и русском: для снимков экрана на нужном языке.
// Ключ — немецкое название из mockShowroom.ts.
export const SHOWROOM_NAMES: Record<'en' | 'ru', Record<string, string>> = {
  en: {
    'Zuhause': 'Home', 'Bad': 'Bathroom', 'Büro': 'Office', 'Flur': 'Hallway', 'Garten': 'Garden', 'Keller': 'Basement',
    'Kinderzimmer': 'Kids room', 'Küche': 'Kitchen', 'Schlafzimmer': 'Bedroom', 'Wohnzimmer': 'Living room',
    'AV-Receiver': 'AV receiver', 'Alle weg': 'Everyone out', 'Außensensor': 'Outdoor sensor', 'Badlüfter': 'Bathroom fan',
    'Bewegungsmelder Bad': 'Bathroom motion sensor', 'Bewässerung': 'Irrigation', 'Bügeleisen': 'Iron',
    'Deckenlampe': 'Ceiling light', 'Erschütterungssensor': 'Vibration sensor', 'Fenster Flur': 'Hallway window',
    'Fernseher': 'TV', 'Filmabend': 'Movie night', 'Futterautomat': 'Pet feeder', 'Gartenbeleuchtung': 'Garden lights',
    'Gasmelder': 'Gas detector', 'Gaszähler': 'Gas meter', 'Geschirrspüler': 'Dishwasher', 'Gute Nacht': 'Good night',
    'Haustür': 'Front door', 'Heizkörperthermostat': 'Radiator thermostat', 'Helligkeitssensor': 'Light sensor',
    'Jalousie': 'Blinds', 'Kaffeemaschine': 'Coffee machine', 'Kaltwasserzähler': 'Cold water meter',
    'Kamera Eingang': 'Entrance camera', 'Klimaanlage': 'Air conditioner', 'Klimasensor': 'Climate sensor',
    'Küchengerät': 'Kitchen appliance', 'LED-Streifen': 'LED strip', 'Licht Wohnzimmer': 'Living room lights',
    'Lichtschalter': 'Light switch', 'Luftbefeuchter': 'Humidifier', 'Luftqualität': 'Air quality', 'Luftreiniger': 'Air purifier',
    'Multikocher': 'Multicooker', 'Nachtlicht': 'Night light', 'Nachttischlampe': 'Bedside lamp', 'Rauchmelder': 'Smoke detector',
    'Relais Außenlicht': 'Outdoor light relay', 'Saugroboter': 'Robot vacuum', 'Schreibtischlampe': 'Desk lamp',
    'Steckdose Arbeitsplatte': 'Counter socket', 'Steckdose Monitor': 'Monitor socket', 'Stehlampe': 'Floor lamp',
    'Stromzähler': 'Electricity meter', 'TV-Box': 'TV box', 'Taster': 'Button', 'Trinkbrunnen': 'Pet fountain',
    'Ventilator': 'Fan', 'Vorhänge': 'Curtains', 'Warmwasserzähler': 'Hot water meter', 'Waschmaschine': 'Washing machine',
    'Wasserkocher': 'Kettle', 'Wassermelder Keller': 'Basement leak sensor', 'Wassermelder Spüle': 'Sink leak sensor',
    'Wasserventil': 'Water valve', 'Wärmezähler': 'Heat meter', 'Zigbee-Hub': 'Zigbee hub',
  },
  ru: {
    'Zuhause': 'Дом', 'Bad': 'Ванная', 'Büro': 'Кабинет', 'Flur': 'Прихожая', 'Garten': 'Сад', 'Keller': 'Подвал',
    'Kinderzimmer': 'Детская', 'Küche': 'Кухня', 'Schlafzimmer': 'Спальня', 'Wohnzimmer': 'Гостиная',
    'AV-Receiver': 'AV-ресивер', 'Alle weg': 'Все ушли', 'Außensensor': 'Уличный датчик', 'Badlüfter': 'Вытяжка',
    'Bewegungsmelder Bad': 'Датчик движения', 'Bewässerung': 'Полив', 'Bügeleisen': 'Утюг',
    'Deckenlampe': 'Люстра', 'Erschütterungssensor': 'Датчик вибрации', 'Fenster Flur': 'Окно в прихожей',
    'Fernseher': 'Телевизор', 'Filmabend': 'Кино', 'Futterautomat': 'Кормушка', 'Gartenbeleuchtung': 'Свет в саду',
    'Gasmelder': 'Датчик газа', 'Gaszähler': 'Счётчик газа', 'Geschirrspüler': 'Посудомойка', 'Gute Nacht': 'Спокойной ночи',
    'Haustür': 'Входная дверь', 'Heizkörperthermostat': 'Термостат радиатора', 'Helligkeitssensor': 'Датчик освещённости',
    'Jalousie': 'Жалюзи', 'Kaffeemaschine': 'Кофемашина', 'Kaltwasserzähler': 'Счётчик холодной воды',
    'Kamera Eingang': 'Камера у входа', 'Klimaanlage': 'Кондиционер', 'Klimasensor': 'Датчик климата',
    'Küchengerät': 'Кухонный прибор', 'LED-Streifen': 'Светодиодная лента', 'Licht Wohnzimmer': 'Свет в гостиной',
    'Lichtschalter': 'Выключатель', 'Luftbefeuchter': 'Увлажнитель', 'Luftqualität': 'Качество воздуха', 'Luftreiniger': 'Очиститель воздуха',
    'Multikocher': 'Мультиварка', 'Nachtlicht': 'Ночник', 'Nachttischlampe': 'Прикроватная лампа', 'Rauchmelder': 'Датчик дыма',
    'Relais Außenlicht': 'Реле уличного света', 'Saugroboter': 'Робот-пылесос', 'Schreibtischlampe': 'Настольная лампа',
    'Steckdose Arbeitsplatte': 'Розетка на кухне', 'Steckdose Monitor': 'Розетка монитора', 'Stehlampe': 'Торшер',
    'Stromzähler': 'Счётчик электричества', 'TV-Box': 'ТВ-приставка', 'Taster': 'Кнопка', 'Trinkbrunnen': 'Поилка',
    'Ventilator': 'Вентилятор', 'Vorhänge': 'Шторы', 'Warmwasserzähler': 'Счётчик горячей воды', 'Waschmaschine': 'Стиральная машина',
    'Wasserkocher': 'Чайник', 'Wassermelder Keller': 'Датчик протечки в подвале', 'Wassermelder Spüle': 'Датчик протечки у мойки',
    'Wasserventil': 'Кран воды', 'Wärmezähler': 'Счётчик тепла', 'Zigbee-Hub': 'Хаб Zigbee',
  },
};

/** Переводит все названия дома (дома, комнаты, устройства, группы, сценарии) на язык интерфейса. */
export const localizeShowroom = <T extends { households: any[]; rooms: any[]; devices: any[]; groups: any[]; scenarios: any[] }>(home: T, lang: string): T => {
  const names = SHOWROOM_NAMES[lang as 'en' | 'ru'];
  if (!names) return home;
  const rename = <I extends { name: string }>(item: I): I => ({ ...item, name: names[item.name] ?? item.name });
  return {
    ...home,
    households: home.households.map(rename), rooms: home.rooms.map(rename), devices: home.devices.map(rename),
    groups: home.groups.map(rename), scenarios: home.scenarios.map(rename),
  };
};
