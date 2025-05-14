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
        </datalist><label>Телефон рабочий:</label>
        <span v-if="errors.phone" class="error-message">{{ errors.phone }}</span>
        <MaskInput v-model="phone" mask="phoneMask.toString()" :placeholder="phonePlaceholder" @keydown.esc="clearPhone"
            :class="{ 'invalid': errors.phone }" />
        <label>Телефон сотовый:</label>
        <MaskInput v-model="phonecell" mask="+375(##) ###-##-##"
            placeholder="+375 (..) Вводите только код оператора и номер" v-clearonesc title="Вводить только цифры "
            @keydown.esc="clearPhoneCell" @input="checkMobilePhoneInput" />
    </div>
</template>
<script>
import { ref, onMounted, watch } from 'vue'
import { debounce } from 'lodash-es';
import { MaskInput } from 'vue-mask-next';
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
            zipcode: '',
            phone: ''
        });
        const csvData = ref([]);
        const phoneMask = ref('');
        const citySearch = ref('');
        const filteredCities = ref([]);
        const phonePlaceholder = ref('');
        const cellphonePlaceholder = ref('+375 (__) ___-__-__');
        const selectCity = (cityItem) => {
            if (!cityItem) return;
            city.value = cityItem.name;
            const isMinsk = cityItem.name.replace(',', '').trim() === 'Минск';
            citySearch.value = isMinsk
                ? `${cityItem.type} ${cityItem.name.replace(',', '')}`
                : `${cityItem.type} ${cityItem.name}, ${cityItem.region}`;
            region.value = isMinsk ? '' : cityItem.region;
            if (cityItem.phonemask) {
                phoneMask.value = cityItem.phonemask;
                const expectedDigits = phoneMask.value.match(/#/g)?.length || 0;
                phonePlaceholder.value = phoneMask.value ? `${phoneMask.value.replace(/#/g, '_')} (введите ${expectedDigits} цифр)` : '';
            } else {
                phoneMask.value = '';
                phonePlaceholder.value = '';
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
        watch(citySearch, debounce((newVal) => {
            if (!newVal || !csvData.value.length) {
                city.value = '';
                region.value = '';
                phonePlaceholder.value = phoneMask.value.replace(/#/g, '_');
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
                                    item.phonemask = `+375 (${code}) ###-##-##`;
                                } else if (code.length === 3) {
                                    item.phonemask = `+375 (${code}) ##-##-##`;
                                } else if (code.length === 4) {
                                    item.phonemask = `+375 (${code}) #-##-##`;
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
return {
            clearPhone,
            clearPhoneCell, data,
            phone,
            phonecell,
            address,
            region,
            city,
            phoneMask,
            phonePlaceholder,
            citySearch,
            filteredCities,
            handleCitySearch,
            errors,
            selectCity
        };
    }
};
</script>
