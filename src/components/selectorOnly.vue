<template>
    <div id="app">
        <label>Населенный пункт:</label>
        <span v-if="errors.citySearch" class="error-message">{{ errors.citySearch }}</span>
        <input v-model="citySearch" @input="handleCitySearch"
            placeholder="Начните вводить название населенного пункта..." list="cityOptions" style="width: 450px;"
            :class="{ 'invalid': errors.citySearch }" v-clearonesc />
        <datalist id="cityOptions">
            <option v-for="(cityItem, index) in filteredCities" :key="index" :value="cityItem.name.replace(',', '').trim() === 'Минск'
                ? `${cityItem.type} ${cityItem.name.replace(',', '')}`
                : `${cityItem.type} ${cityItem.name}, ${cityItem.region}`" @click="selectCity(cityItem)">
            </option>
        </datalist>

        <label>Телефон рабочий MaskInput:</label>
        <span v-if="errors.phone" class="error-message">{{ errors.phone }}</span>
        <MaskInput v-model="phone" :mask="phonemask" :placeholder="phonePlaceholder" v-clearonesc
        :class="{ 'invalid': errors.phone }"  :key="phonemask"/>
        <label>2Телефон рабочий input:</label>
        <input v-model="phone" :mask="phonemask" :placeholder="phonePlaceholder" @keydown.esc="clearPhone"
            :class="{ 'invalid': errors.phone }"  :key="phonemask"/>
          
        <label>Телефон сотовый:</label>
        <MaskInput v-model="phonecell" mask="+375(##) ###-##-##" placeholder="+375 (__) ___-__-__" v-clearonesc
            title="Вводить только цифры" @keydown.esc="clearPhoneCell" />
    </div>
</template>

<script>
import { ref, onMounted, watch,computed  } from 'vue'
import { debounce } from 'lodash-es';
// import { MaskInput } from 'vue-mask-next';
import { MaskInput } from 'vue-3-mask';
import Papa from 'papaparse';

export default {
    components: { MaskInput },
    setup() {
        const data = ref('');
        const phone = ref('');
        const phonecell = ref('');
        const address = ref("");
        const region = ref('');
        const city = ref('');

        const errors = ref({
            citySearch: '',
            phone: ''
        });

        const csvData = ref([]);
        const phonemask = ref('');
        const citySearch = ref('');
        const filteredCities = ref([]);
        const phonePlaceholder = ref('Выберите город для отображения маски');
       
        const selectCity = (cityItem) => {
            if (!cityItem) return;

            city.value = cityItem.name;
            const isMinsk = cityItem.name.replace(',', '').trim() === 'Минск';

            citySearch.value = isMinsk
                ? `${cityItem.type} ${cityItem.name.replace(',', '')}`
                : `${cityItem.type} ${cityItem.name}, ${cityItem.region}`;

            region.value = isMinsk ? '' : cityItem.region;

            if (cityItem.phonemask) {
                phonemask.value = cityItem.phonemask;
                // Подсчёт только цифр номера (без кода города)
                const numberPart = phonemask.value.split(')')[1] || '';
                const numberDigits = numberPart.match(/#/g)?.length || 0;
                phonePlaceholder.value = `${phonemask.value.replace(/#/g, '_')} (введите ${numberDigits} цифр)`;
            } else {
                phonemask.value = '';
                phonePlaceholder.value = 'Маска для этого города не определена';
            }

            phone.value = '';
            phonecell.value = '';
        };

        const handleCitySearch = () => {
            if (!citySearch.value) {
                filteredCities.value = [];
                phone.value = '';
                return;
            }

            if (!csvData.value || csvData.value.length === 0) {
                console.error('Данные городов не загружены');
                filteredCities.value = [];
                return;
            }

            const searchTerm = citySearch.value.toLowerCase();
            filteredCities.value = csvData.value
                .filter(item => {
                    if (!item || !item.name || !item.type) return false;
                    try {
                        const cityName = item.name.toLowerCase().replace(',', '');
                        const cityType = item.type.toLowerCase();
                        const cityRegion = item.region ? item.region.toLowerCase() : '';
                        return (
                            cityName.includes(searchTerm) ||
                            cityType.includes(searchTerm) ||
                            (cityRegion && cityRegion.includes(searchTerm)))
                    } catch (e) {
                        console.error('Ошибка при фильтрации города:', e, item);
                        return false;
                    }
                })
                .slice(0, 20);
        };

        const clearPhone = () => {
            phone.value = '';
        };

        const clearPhoneCell = () => {
            phonecell.value = '';
        };

        const validatePhone = () => {
            if (!phonemask.value) return;

            const numberPart = phonemask.value.split(')')[1] || '';
            const expectedDigits = numberPart.match(/#/g)?.length || 0;
            const enteredDigits = phone.value.replace(/\D/g, '').length;



            errors.value.phone = '';
            return true;
        };

        watch(phone, () => {
            validatePhone();
        });

        watch(citySearch, debounce((newVal) => {
            if (!newVal || !csvData.value.length) {
                city.value = '';
                region.value = '';
                phonemask.value = '';
                phonePlaceholder.value = 'Выберите город для отображения маски';
                phone.value = '';
                phonecell.value = '';
                return;
            }

            const match = csvData.value.find(item => {
                const isMinsk = item.name.replace(',', '').trim() === 'Минск';
                const itemValue = isMinsk
                    ? `${item.type} ${item.name.replace(',', '')}`
                    : `${item.type} ${item.name}, ${item.region}`;
                return itemValue === newVal;
            });

            if (match) {
                selectCity(match);
            }
        }, 100));

        const loadCSVData = async () => {
            try {
                const response = await fetch('/cities.csv');
                if (!response.ok) throw new Error(`HTTP ошибка! статус: ${response.status}`);
                const csvText = await response.text();
                if (!csvText) throw new Error("CSV-файл пуст");

                Papa.parse(csvText, {
                    header: true,
                    complete: (results) => {
                        if (!results.data || results.data.length === 0) {
                            console.error("Файл CSV пуст или поврежден");
                            return;
                        }
                        csvData.value = results.data.map(item => {
                            if (!item.phonemask && item.phonecode) {
                                const code = item.phonecode.replace('+375', '').trim();
                                if (code.length === 2) {
                                    // Для 2-значных кодов: 7 цифр номера (###-##-##)
                                    item.phonemask = `+375 (${code}) ###-##-##`;
                                } else if (code.length === 3) {
                                    // Для 3-значных кодов: 6 цифр номера (##-##-##)
                                    item.phonemask = `+375 (${code}) ##-##-##`;
                                } else if (code.length === 4) {
                                    // Для 4-значных кодов: 5 цифр подряд без разделителей
                                    item.phonemask = `+375 (${code}) #####`;
                                }
                            }
                            return item;
                        });
                    },
                    error: (error) => {
                        console.error("Ошибка парсинга CSV:", error);
                    }
                });
            } catch (error) {
                console.error('Ошибка загрузки CSV:', error);
            }
        };

        onMounted(async () => {
            await loadCSVData();
        });
        const computedMask = computed(() => { 
            console.log(phonemask.value);
            return phonemask.value});
        return {
            data,
            phone,
            phonecell,
            address,
            region,
            city,
            phonemask,
            phonePlaceholder,
            citySearch,
            filteredCities,
            errors,
            clearPhone,
            clearPhoneCell,
            handleCitySearch,
            selectCity
        };
    },

directives: {
   clearonesc: {
      mounted(el) {
         el.addEventListener('keydown', async function (event) {
            if (event.key === 'Escape') {
               el.value = "";
               el.dispatchEvent(new Event('input'));
            }
         });
      }
   }
}
};
</script>

<style scoped>
label {width: 300px;}
.error-message {
    color: red;
    font-size: 0.8em;
    margin-left: 5px;
}

.invalid {
    border-color: red;
}
</style>