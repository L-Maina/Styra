// Complete worldwide countries data file
// Includes ALL countries with ISO codes, dial codes, currencies, and flags

export interface Country {
  name: string;
  code: string; // ISO 3166-1 alpha-2
  dialCode: string;
  currency: {
    code: string;
    symbol: string;
    name: string;
  };
  flag: string;
  locale: string;
}

// Complete list of ALL countries worldwide (195+ countries)
export const COUNTRIES: Country[] = [
  { name: 'Afghanistan', code: 'AF', dialCode: '+93', currency: { code: 'AFN', symbol: '؋', name: 'Afghan Afghani' }, flag: '🇦🇫', locale: 'fa-AF' },
  { name: 'Albania', code: 'AL', dialCode: '+355', currency: { code: 'ALL', symbol: 'L', name: 'Albanian Lek' }, flag: '🇦🇱', locale: 'sq-AL' },
  { name: 'Algeria', code: 'DZ', dialCode: '+213', currency: { code: 'DZD', symbol: 'د.ج', name: 'Algerian Dinar' }, flag: '🇩🇿', locale: 'ar-DZ' },
  { name: 'Andorra', code: 'AD', dialCode: '+376', currency: { code: 'EUR', symbol: '€', name: 'Euro' }, flag: '🇦🇩', locale: 'ca-AD' },
  { name: 'Angola', code: 'AO', dialCode: '+244', currency: { code: 'AOA', symbol: 'Kz', name: 'Angolan Kwanza' }, flag: '🇦🇴', locale: 'pt-AO' },
  { name: 'Antigua and Barbuda', code: 'AG', dialCode: '+1-268', currency: { code: 'XCD', symbol: '$', name: 'East Caribbean Dollar' }, flag: '🇦🇬', locale: 'en-AG' },
  { name: 'Argentina', code: 'AR', dialCode: '+54', currency: { code: 'ARS', symbol: '$', name: 'Argentine Peso' }, flag: '🇦🇷', locale: 'es-AR' },
  { name: 'Armenia', code: 'AM', dialCode: '+374', currency: { code: 'AMD', symbol: '֏', name: 'Armenian Dram' }, flag: '🇦🇲', locale: 'hy-AM' },
  { name: 'Australia', code: 'AU', dialCode: '+61', currency: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' }, flag: '🇦🇺', locale: 'en-AU' },
  { name: 'Austria', code: 'AT', dialCode: '+43', currency: { code: 'EUR', symbol: '€', name: 'Euro' }, flag: '🇦🇹', locale: 'de-AT' },
  { name: 'Azerbaijan', code: 'AZ', dialCode: '+994', currency: { code: 'AZN', symbol: '₼', name: 'Azerbaijani Manat' }, flag: '🇦🇿', locale: 'az-AZ' },
  { name: 'Bahamas', code: 'BS', dialCode: '+1-242', currency: { code: 'BSD', symbol: '$', name: 'Bahamian Dollar' }, flag: '🇧🇸', locale: 'en-BS' },
  { name: 'Bahrain', code: 'BH', dialCode: '+973', currency: { code: 'BHD', symbol: '.د.ب', name: 'Bahraini Dinar' }, flag: '🇧🇭', locale: 'ar-BH' },
  { name: 'Bangladesh', code: 'BD', dialCode: '+880', currency: { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka' }, flag: '🇧🇩', locale: 'bn-BD' },
  { name: 'Barbados', code: 'BB', dialCode: '+1-246', currency: { code: 'BBD', symbol: '$', name: 'Barbadian Dollar' }, flag: '🇧🇧', locale: 'en-BB' },
  { name: 'Belarus', code: 'BY', dialCode: '+375', currency: { code: 'BYN', symbol: 'Br', name: 'Belarusian Ruble' }, flag: '🇧🇾', locale: 'be-BY' },
  { name: 'Belgium', code: 'BE', dialCode: '+32', currency: { code: 'EUR', symbol: '€', name: 'Euro' }, flag: '🇧🇪', locale: 'nl-BE' },
  { name: 'Belize', code: 'BZ', dialCode: '+501', currency: { code: 'BZD', symbol: '$', name: 'Belize Dollar' }, flag: '🇧🇿', locale: 'en-BZ' },
  { name: 'Benin', code: 'BJ', dialCode: '+229', currency: { code: 'XOF', symbol: 'CFA', name: 'West African CFA Franc' }, flag: '🇧🇯', locale: 'fr-BJ' },
  { name: 'Bhutan', code: 'BT', dialCode: '+975', currency: { code: 'BTN', symbol: 'Nu.', name: 'Bhutanese Ngultrum' }, flag: '🇧🇹', locale: 'dz-BT' },
  { name: 'Bolivia', code: 'BO', dialCode: '+591', currency: { code: 'BOB', symbol: 'Bs.', name: 'Bolivian Boliviano' }, flag: '🇧🇴', locale: 'es-BO' },
  { name: 'Bosnia and Herzegovina', code: 'BA', dialCode: '+387', currency: { code: 'BAM', symbol: 'KM', name: 'Bosnia-Herzegovina Convertible Mark' }, flag: '🇧🇦', locale: 'bs-BA' },
  { name: 'Botswana', code: 'BW', dialCode: '+267', currency: { code: 'BWP', symbol: 'P', name: 'Botswanan Pula' }, flag: '🇧🇼', locale: 'en-BW' },
  { name: 'Brazil', code: 'BR', dialCode: '+55', currency: { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' }, flag: '🇧🇷', locale: 'pt-BR' },
  { name: 'Brunei', code: 'BN', dialCode: '+673', currency: { code: 'BND', symbol: '$', name: 'Brunei Dollar' }, flag: '🇧🇳', locale: 'ms-BN' },
  { name: 'Bulgaria', code: 'BG', dialCode: '+359', currency: { code: 'BGN', symbol: 'лв', name: 'Bulgarian Lev' }, flag: '🇧🇬', locale: 'bg-BG' },
  { name: 'Burkina Faso', code: 'BF', dialCode: '+226', currency: { code: 'XOF', symbol: 'CFA', name: 'West African CFA Franc' }, flag: '🇧🇫', locale: 'fr-BF' },
  { name: 'Burundi', code: 'BI', dialCode: '+257', currency: { code: 'BIF', symbol: 'FBu', name: 'Burundian Franc' }, flag: '🇧🇮', locale: 'fr-BI' },
  { name: 'Cabo Verde', code: 'CV', dialCode: '+238', currency: { code: 'CVE', symbol: 'Esc', name: 'Cape Verdean Escudo' }, flag: '🇨🇻', locale: 'pt-CV' },
  { name: 'Cambodia', code: 'KH', dialCode: '+855', currency: { code: 'KHR', symbol: '៛', name: 'Cambodian Riel' }, flag: '🇰🇭', locale: 'km-KH' },
  { name: 'Cameroon', code: 'CM', dialCode: '+237', currency: { code: 'XAF', symbol: 'CFA', name: 'Central African CFA Franc' }, flag: '🇨🇲', locale: 'fr-CM' },
  { name: 'Canada', code: 'CA', dialCode: '+1', currency: { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' }, flag: '🇨🇦', locale: 'en-CA' },
  { name: 'Central African Republic', code: 'CF', dialCode: '+236', currency: { code: 'XAF', symbol: 'CFA', name: 'Central African CFA Franc' }, flag: '🇨🇫', locale: 'fr-CF' },
  { name: 'Chad', code: 'TD', dialCode: '+235', currency: { code: 'XAF', symbol: 'CFA', name: 'Central African CFA Franc' }, flag: '🇹🇩', locale: 'fr-TD' },
  { name: 'Chile', code: 'CL', dialCode: '+56', currency: { code: 'CLP', symbol: '$', name: 'Chilean Peso' }, flag: '🇨🇱', locale: 'es-CL' },
  { name: 'China', code: 'CN', dialCode: '+86', currency: { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' }, flag: '🇨🇳', locale: 'zh-CN' },
  { name: 'Colombia', code: 'CO', dialCode: '+57', currency: { code: 'COP', symbol: '$', name: 'Colombian Peso' }, flag: '🇨🇴', locale: 'es-CO' },
  { name: 'Comoros', code: 'KM', dialCode: '+269', currency: { code: 'KMF', symbol: 'CF', name: 'Comorian Franc' }, flag: '🇰🇲', locale: 'ar-KM' },
  { name: 'Congo', code: 'CG', dialCode: '+242', currency: { code: 'XAF', symbol: 'CFA', name: 'Central African CFA Franc' }, flag: '🇨🇬', locale: 'fr-CG' },
  { name: 'Congo (DRC)', code: 'CD', dialCode: '+243', currency: { code: 'CDF', symbol: 'FC', name: 'Congolese Franc' }, flag: '🇨🇩', locale: 'fr-CD' },
  { name: 'Costa Rica', code: 'CR', dialCode: '+506', currency: { code: 'CRC', symbol: '₡', name: 'Costa Rican Colón' }, flag: '🇨🇷', locale: 'es-CR' },
  { name: "Côte d'Ivoire", code: 'CI', dialCode: '+225', currency: { code: 'XOF', symbol: 'CFA', name: 'West African CFA Franc' }, flag: '🇨🇮', locale: 'fr-CI' },
  { name: 'Croatia', code: 'HR', dialCode: '+385', currency: { code: 'EUR', symbol: '€', name: 'Euro' }, flag: '🇭🇷', locale: 'hr-HR' },
  { name: 'Cuba', code: 'CU', dialCode: '+53', currency: { code: 'CUP', symbol: '$', name: 'Cuban Peso' }, flag: '🇨🇺', locale: 'es-CU' },
  { name: 'Cyprus', code: 'CY', dialCode: '+357', currency: { code: 'EUR', symbol: '€', name: 'Euro' }, flag: '🇨🇾', locale: 'el-CY' },
  { name: 'Czech Republic', code: 'CZ', dialCode: '+420', currency: { code: 'CZK', symbol: 'Kč', name: 'Czech Koruna' }, flag: '🇨🇿', locale: 'cs-CZ' },
  { name: 'Denmark', code: 'DK', dialCode: '+45', currency: { code: 'DKK', symbol: 'kr', name: 'Danish Krone' }, flag: '🇩🇰', locale: 'da-DK' },
  { name: 'Djibouti', code: 'DJ', dialCode: '+253', currency: { code: 'DJF', symbol: 'Fdj', name: 'Djiboutian Franc' }, flag: '🇩🇯', locale: 'fr-DJ' },
  { name: 'Dominica', code: 'DM', dialCode: '+1-767', currency: { code: 'XCD', symbol: '$', name: 'East Caribbean Dollar' }, flag: '🇩🇲', locale: 'en-DM' },
  { name: 'Dominican Republic', code: 'DO', dialCode: '+1-809', currency: { code: 'DOP', symbol: '$', name: 'Dominican Peso' }, flag: '🇩🇴', locale: 'es-DO' },
  { name: 'Ecuador', code: 'EC', dialCode: '+593', currency: { code: 'USD', symbol: '$', name: 'US Dollar' }, flag: '🇪🇨', locale: 'es-EC' },
  { name: 'Egypt', code: 'EG', dialCode: '+20', currency: { code: 'EGP', symbol: 'E£', name: 'Egyptian Pound' }, flag: '🇪🇬', locale: 'ar-EG' },
  { name: 'El Salvador', code: 'SV', dialCode: '+503', currency: { code: 'USD', symbol: '$', name: 'US Dollar' }, flag: '🇸🇻', locale: 'es-SV' },
  { name: 'Equatorial Guinea', code: 'GQ', dialCode: '+240', currency: { code: 'XAF', symbol: 'CFA', name: 'Central African CFA Franc' }, flag: '🇬🇶', locale: 'es-GQ' },
  { name: 'Eritrea', code: 'ER', dialCode: '+291', currency: { code: 'ERN', symbol: 'Nfk', name: 'Eritrean Nakfa' }, flag: '🇪🇷', locale: 'ti-ER' },
  { name: 'Estonia', code: 'EE', dialCode: '+372', currency: { code: 'EUR', symbol: '€', name: 'Euro' }, flag: '🇪🇪', locale: 'et-EE' },
  { name: 'Eswatini', code: 'SZ', dialCode: '+268', currency: { code: 'SZL', symbol: 'E', name: 'Swazi Lilangeni' }, flag: '🇸🇿', locale: 'en-SZ' },
  { name: 'Ethiopia', code: 'ET', dialCode: '+251', currency: { code: 'ETB', symbol: 'Br', name: 'Ethiopian Birr' }, flag: '🇪🇹', locale: 'am-ET' },
  { name: 'Fiji', code: 'FJ', dialCode: '+679', currency: { code: 'FJD', symbol: '$', name: 'Fijian Dollar' }, flag: '🇫🇯', locale: 'en-FJ' },
  { name: 'Finland', code: 'FI', dialCode: '+358', currency: { code: 'EUR', symbol: '€', name: 'Euro' }, flag: '🇫🇮', locale: 'fi-FI' },
  { name: 'France', code: 'FR', dialCode: '+33', currency: { code: 'EUR', symbol: '€', name: 'Euro' }, flag: '🇫🇷', locale: 'fr-FR' },
  { name: 'Gabon', code: 'GA', dialCode: '+241', currency: { code: 'XAF', symbol: 'CFA', name: 'Central African CFA Franc' }, flag: '🇬🇦', locale: 'fr-GA' },
  { name: 'Gambia', code: 'GM', dialCode: '+220', currency: { code: 'GMD', symbol: 'D', name: 'Gambian Dalasi' }, flag: '🇬🇲', locale: 'en-GM' },
  { name: 'Georgia', code: 'GE', dialCode: '+995', currency: { code: 'GEL', symbol: '₾', name: 'Georgian Lari' }, flag: '🇬🇪', locale: 'ka-GE' },
  { name: 'Germany', code: 'DE', dialCode: '+49', currency: { code: 'EUR', symbol: '€', name: 'Euro' }, flag: '🇩🇪', locale: 'de-DE' },
  { name: 'Ghana', code: 'GH', dialCode: '+233', currency: { code: 'GHS', symbol: '₵', name: 'Ghanaian Cedi' }, flag: '🇬🇭', locale: 'en-GH' },
  { name: 'Greece', code: 'GR', dialCode: '+30', currency: { code: 'EUR', symbol: '€', name: 'Euro' }, flag: '🇬🇷', locale: 'el-GR' },
  { name: 'Grenada', code: 'GD', dialCode: '+1-473', currency: { code: 'XCD', symbol: '$', name: 'East Caribbean Dollar' }, flag: '🇬🇩', locale: 'en-GD' },
  { name: 'Guatemala', code: 'GT', dialCode: '+502', currency: { code: 'GTQ', symbol: 'Q', name: 'Guatemalan Quetzal' }, flag: '🇬🇹', locale: 'es-GT' },
  { name: 'Guinea', code: 'GN', dialCode: '+224', currency: { code: 'GNF', symbol: 'FG', name: 'Guinean Franc' }, flag: '🇬🇳', locale: 'fr-GN' },
  { name: 'Guinea-Bissau', code: 'GW', dialCode: '+245', currency: { code: 'XOF', symbol: 'CFA', name: 'West African CFA Franc' }, flag: '🇬🇼', locale: 'pt-GW' },
  { name: 'Guyana', code: 'GY', dialCode: '+592', currency: { code: 'GYD', symbol: '$', name: 'Guyanese Dollar' }, flag: '🇬🇾', locale: 'en-GY' },
  { name: 'Haiti', code: 'HT', dialCode: '+509', currency: { code: 'HTG', symbol: 'G', name: 'Haitian Gourde' }, flag: '🇭🇹', locale: 'fr-HT' },
  { name: 'Honduras', code: 'HN', dialCode: '+504', currency: { code: 'HNL', symbol: 'L', name: 'Honduran Lempira' }, flag: '🇭🇳', locale: 'es-HN' },
  { name: 'Hungary', code: 'HU', dialCode: '+36', currency: { code: 'HUF', symbol: 'Ft', name: 'Hungarian Forint' }, flag: '🇭🇺', locale: 'hu-HU' },
  { name: 'Iceland', code: 'IS', dialCode: '+354', currency: { code: 'ISK', symbol: 'kr', name: 'Icelandic Króna' }, flag: '🇮🇸', locale: 'is-IS' },
  { name: 'India', code: 'IN', dialCode: '+91', currency: { code: 'INR', symbol: '₹', name: 'Indian Rupee' }, flag: '🇮🇳', locale: 'en-IN' },
  { name: 'Indonesia', code: 'ID', dialCode: '+62', currency: { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah' }, flag: '🇮🇩', locale: 'id-ID' },
  { name: 'Iran', code: 'IR', dialCode: '+98', currency: { code: 'IRR', symbol: '﷼', name: 'Iranian Rial' }, flag: '🇮🇷', locale: 'fa-IR' },
  { name: 'Iraq', code: 'IQ', dialCode: '+964', currency: { code: 'IQD', symbol: 'ع.د', name: 'Iraqi Dinar' }, flag: '🇮🇶', locale: 'ar-IQ' },
  { name: 'Ireland', code: 'IE', dialCode: '+353', currency: { code: 'EUR', symbol: '€', name: 'Euro' }, flag: '🇮🇪', locale: 'en-IE' },
  { name: 'Israel', code: 'IL', dialCode: '+972', currency: { code: 'ILS', symbol: '₪', name: 'Israeli New Shekel' }, flag: '🇮🇱', locale: 'he-IL' },
  { name: 'Italy', code: 'IT', dialCode: '+39', currency: { code: 'EUR', symbol: '€', name: 'Euro' }, flag: '🇮🇹', locale: 'it-IT' },
  { name: 'Jamaica', code: 'JM', dialCode: '+1-876', currency: { code: 'JMD', symbol: '$', name: 'Jamaican Dollar' }, flag: '🇯🇲', locale: 'en-JM' },
  { name: 'Japan', code: 'JP', dialCode: '+81', currency: { code: 'JPY', symbol: '¥', name: 'Japanese Yen' }, flag: '🇯🇵', locale: 'ja-JP' },
  { name: 'Jordan', code: 'JO', dialCode: '+962', currency: { code: 'JOD', symbol: 'د.ا', name: 'Jordanian Dinar' }, flag: '🇯🇴', locale: 'ar-JO' },
  { name: 'Kazakhstan', code: 'KZ', dialCode: '+7', currency: { code: 'KZT', symbol: '₸', name: 'Kazakhstani Tenge' }, flag: '🇰🇿', locale: 'kk-KZ' },
  { name: 'Kenya', code: 'KE', dialCode: '+254', currency: { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling' }, flag: '🇰🇪', locale: 'en-KE' },
  { name: 'Kiribati', code: 'KI', dialCode: '+686', currency: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' }, flag: '🇰🇮', locale: 'en-KI' },
  { name: 'Kuwait', code: 'KW', dialCode: '+965', currency: { code: 'KWD', symbol: 'د.ك', name: 'Kuwaiti Dinar' }, flag: '🇰🇼', locale: 'ar-KW' },
  { name: 'Kyrgyzstan', code: 'KG', dialCode: '+996', currency: { code: 'KGS', symbol: 'с', name: 'Kyrgyzstani Som' }, flag: '🇰🇬', locale: 'ky-KG' },
  { name: 'Laos', code: 'LA', dialCode: '+856', currency: { code: 'LAK', symbol: '₭', name: 'Lao Kip' }, flag: '🇱🇦', locale: 'lo-LA' },
  { name: 'Latvia', code: 'LV', dialCode: '+371', currency: { code: 'EUR', symbol: '€', name: 'Euro' }, flag: '🇱🇻', locale: 'lv-LV' },
  { name: 'Lebanon', code: 'LB', dialCode: '+961', currency: { code: 'LBP', symbol: 'ل.ل', name: 'Lebanese Pound' }, flag: '🇱🇧', locale: 'ar-LB' },
  { name: 'Lesotho', code: 'LS', dialCode: '+266', currency: { code: 'LSL', symbol: 'L', name: 'Lesotho Loti' }, flag: '🇱🇸', locale: 'en-LS' },
  { name: 'Liberia', code: 'LR', dialCode: '+231', currency: { code: 'LRD', symbol: '$', name: 'Liberian Dollar' }, flag: '🇱🇷', locale: 'en-LR' },
  { name: 'Libya', code: 'LY', dialCode: '+218', currency: { code: 'LYD', symbol: 'ل.د', name: 'Libyan Dinar' }, flag: '🇱🇾', locale: 'ar-LY' },
  { name: 'Liechtenstein', code: 'LI', dialCode: '+423', currency: { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' }, flag: '🇱🇮', locale: 'de-LI' },
  { name: 'Lithuania', code: 'LT', dialCode: '+370', currency: { code: 'EUR', symbol: '€', name: 'Euro' }, flag: '🇱🇹', locale: 'lt-LT' },
  { name: 'Luxembourg', code: 'LU', dialCode: '+352', currency: { code: 'EUR', symbol: '€', name: 'Euro' }, flag: '🇱🇺', locale: 'fr-LU' },
  { name: 'North Macedonia', code: 'MK', dialCode: '+389', currency: { code: 'MKD', symbol: 'ден', name: 'Macedonian Denar' }, flag: '🇲🇰', locale: 'mk-MK' },
  { name: 'Madagascar', code: 'MG', dialCode: '+261', currency: { code: 'MGA', symbol: 'Ar', name: 'Malagasy Ariary' }, flag: '🇲🇬', locale: 'mg-MG' },
  { name: 'Malawi', code: 'MW', dialCode: '+265', currency: { code: 'MWK', symbol: 'MK', name: 'Malawian Kwacha' }, flag: '🇲🇼', locale: 'en-MW' },
  { name: 'Malaysia', code: 'MY', dialCode: '+60', currency: { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit' }, flag: '🇲🇾', locale: 'ms-MY' },
  { name: 'Maldives', code: 'MV', dialCode: '+960', currency: { code: 'MVR', symbol: 'Rf', name: 'Maldivian Rufiyaa' }, flag: '🇲🇻', locale: 'dv-MV' },
  { name: 'Mali', code: 'ML', dialCode: '+223', currency: { code: 'XOF', symbol: 'CFA', name: 'West African CFA Franc' }, flag: '🇲🇱', locale: 'fr-ML' },
  { name: 'Malta', code: 'MT', dialCode: '+356', currency: { code: 'EUR', symbol: '€', name: 'Euro' }, flag: '🇲🇹', locale: 'mt-MT' },
  { name: 'Marshall Islands', code: 'MH', dialCode: '+692', currency: { code: 'USD', symbol: '$', name: 'US Dollar' }, flag: '🇲🇭', locale: 'en-MH' },
  { name: 'Mauritania', code: 'MR', dialCode: '+222', currency: { code: 'MRU', symbol: 'UM', name: 'Mauritanian Ouguiya' }, flag: '🇲🇷', locale: 'ar-MR' },
  { name: 'Mauritius', code: 'MU', dialCode: '+230', currency: { code: 'MUR', symbol: '₨', name: 'Mauritian Rupee' }, flag: '🇲🇺', locale: 'en-MU' },
  { name: 'Mexico', code: 'MX', dialCode: '+52', currency: { code: 'MXN', symbol: '$', name: 'Mexican Peso' }, flag: '🇲🇽', locale: 'es-MX' },
  { name: 'Micronesia', code: 'FM', dialCode: '+691', currency: { code: 'USD', symbol: '$', name: 'US Dollar' }, flag: '🇫🇲', locale: 'en-FM' },
  { name: 'Moldova', code: 'MD', dialCode: '+373', currency: { code: 'MDL', symbol: 'L', name: 'Moldovan Leu' }, flag: '🇲🇩', locale: 'ro-MD' },
  { name: 'Monaco', code: 'MC', dialCode: '+377', currency: { code: 'EUR', symbol: '€', name: 'Euro' }, flag: '🇲🇨', locale: 'fr-MC' },
  { name: 'Mongolia', code: 'MN', dialCode: '+976', currency: { code: 'MNT', symbol: '₮', name: 'Mongolian Tögrög' }, flag: '🇲🇳', locale: 'mn-MN' },
  { name: 'Montenegro', code: 'ME', dialCode: '+382', currency: { code: 'EUR', symbol: '€', name: 'Euro' }, flag: '🇲🇪', locale: 'sr-ME' },
  { name: 'Morocco', code: 'MA', dialCode: '+212', currency: { code: 'MAD', symbol: 'د.م.', name: 'Moroccan Dirham' }, flag: '🇲🇦', locale: 'ar-MA' },
  { name: 'Mozambique', code: 'MZ', dialCode: '+258', currency: { code: 'MZN', symbol: 'MT', name: 'Mozambican Metical' }, flag: '🇲🇿', locale: 'pt-MZ' },
  { name: 'Myanmar', code: 'MM', dialCode: '+95', currency: { code: 'MMK', symbol: 'K', name: 'Myanmar Kyat' }, flag: '🇲🇲', locale: 'my-MM' },
  { name: 'Namibia', code: 'NA', dialCode: '+264', currency: { code: 'NAD', symbol: '$', name: 'Namibian Dollar' }, flag: '🇳🇦', locale: 'en-NA' },
  { name: 'Nauru', code: 'NR', dialCode: '+674', currency: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' }, flag: '🇳🇷', locale: 'en-NR' },
  { name: 'Nepal', code: 'NP', dialCode: '+977', currency: { code: 'NPR', symbol: '₨', name: 'Nepalese Rupee' }, flag: '🇳🇵', locale: 'ne-NP' },
  { name: 'Netherlands', code: 'NL', dialCode: '+31', currency: { code: 'EUR', symbol: '€', name: 'Euro' }, flag: '🇳🇱', locale: 'nl-NL' },
  { name: 'New Zealand', code: 'NZ', dialCode: '+64', currency: { code: 'NZD', symbol: '$', name: 'New Zealand Dollar' }, flag: '🇳🇿', locale: 'en-NZ' },
  { name: 'Nicaragua', code: 'NI', dialCode: '+505', currency: { code: 'NIO', symbol: 'C$', name: 'Nicaraguan Córdoba' }, flag: '🇳🇮', locale: 'es-NI' },
  { name: 'Niger', code: 'NE', dialCode: '+227', currency: { code: 'XOF', symbol: 'CFA', name: 'West African CFA Franc' }, flag: '🇳🇪', locale: 'fr-NE' },
  { name: 'Nigeria', code: 'NG', dialCode: '+234', currency: { code: 'NGN', symbol: '₦', name: 'Nigerian Naira' }, flag: '🇳🇬', locale: 'en-NG' },
  { name: 'North Korea', code: 'KP', dialCode: '+850', currency: { code: 'KPW', symbol: '₩', name: 'North Korean Won' }, flag: '🇰🇵', locale: 'ko-KP' },
  { name: 'Norway', code: 'NO', dialCode: '+47', currency: { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone' }, flag: '🇳🇴', locale: 'nb-NO' },
  { name: 'Oman', code: 'OM', dialCode: '+968', currency: { code: 'OMR', symbol: 'ر.ع.', name: 'Omani Rial' }, flag: '🇴🇲', locale: 'ar-OM' },
  { name: 'Pakistan', code: 'PK', dialCode: '+92', currency: { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee' }, flag: '🇵🇰', locale: 'ur-PK' },
  { name: 'Palau', code: 'PW', dialCode: '+680', currency: { code: 'USD', symbol: '$', name: 'US Dollar' }, flag: '🇵🇼', locale: 'en-PW' },
  { name: 'Palestine', code: 'PS', dialCode: '+970', currency: { code: 'ILS', symbol: '₪', name: 'Israeli New Shekel' }, flag: '🇵🇸', locale: 'ar-PS' },
  { name: 'Panama', code: 'PA', dialCode: '+507', currency: { code: 'USD', symbol: '$', name: 'US Dollar' }, flag: '🇵🇦', locale: 'es-PA' },
  { name: 'Papua New Guinea', code: 'PG', dialCode: '+675', currency: { code: 'PGK', symbol: 'K', name: 'Papua New Guinean Kina' }, flag: '🇵🇬', locale: 'en-PG' },
  { name: 'Paraguay', code: 'PY', dialCode: '+595', currency: { code: 'PYG', symbol: '₲', name: 'Paraguayan Guaraní' }, flag: '🇵🇾', locale: 'es-PY' },
  { name: 'Peru', code: 'PE', dialCode: '+51', currency: { code: 'PEN', symbol: 'S/', name: 'Peruvian Sol' }, flag: '🇵🇪', locale: 'es-PE' },
  { name: 'Philippines', code: 'PH', dialCode: '+63', currency: { code: 'PHP', symbol: '₱', name: 'Philippine Peso' }, flag: '🇵🇭', locale: 'en-PH' },
  { name: 'Poland', code: 'PL', dialCode: '+48', currency: { code: 'PLN', symbol: 'zł', name: 'Polish Złoty' }, flag: '🇵🇱', locale: 'pl-PL' },
  { name: 'Portugal', code: 'PT', dialCode: '+351', currency: { code: 'EUR', symbol: '€', name: 'Euro' }, flag: '🇵🇹', locale: 'pt-PT' },
  { name: 'Qatar', code: 'QA', dialCode: '+974', currency: { code: 'QAR', symbol: 'ر.ق', name: 'Qatari Rial' }, flag: '🇶🇦', locale: 'ar-QA' },
  { name: 'Romania', code: 'RO', dialCode: '+40', currency: { code: 'RON', symbol: 'lei', name: 'Romanian Leu' }, flag: '🇷🇴', locale: 'ro-RO' },
  { name: 'Russia', code: 'RU', dialCode: '+7', currency: { code: 'RUB', symbol: '₽', name: 'Russian Ruble' }, flag: '🇷🇺', locale: 'ru-RU' },
  { name: 'Rwanda', code: 'RW', dialCode: '+250', currency: { code: 'RWF', symbol: 'FRw', name: 'Rwandan Franc' }, flag: '🇷🇼', locale: 'rw-RW' },
  { name: 'Saint Kitts and Nevis', code: 'KN', dialCode: '+1-869', currency: { code: 'XCD', symbol: '$', name: 'East Caribbean Dollar' }, flag: '🇰🇳', locale: 'en-KN' },
  { name: 'Saint Lucia', code: 'LC', dialCode: '+1-758', currency: { code: 'XCD', symbol: '$', name: 'East Caribbean Dollar' }, flag: '🇱🇨', locale: 'en-LC' },
  { name: 'Saint Vincent and the Grenadines', code: 'VC', dialCode: '+1-784', currency: { code: 'XCD', symbol: '$', name: 'East Caribbean Dollar' }, flag: '🇻🇨', locale: 'en-VC' },
  { name: 'Samoa', code: 'WS', dialCode: '+685', currency: { code: 'WST', symbol: 'T', name: 'Samoan Tālā' }, flag: '🇼🇸', locale: 'en-WS' },
  { name: 'San Marino', code: 'SM', dialCode: '+378', currency: { code: 'EUR', symbol: '€', name: 'Euro' }, flag: '🇸🇲', locale: 'it-SM' },
  { name: 'São Tomé and Príncipe', code: 'ST', dialCode: '+239', currency: { code: 'STN', symbol: 'Db', name: 'São Tomé and Príncipe Dobra' }, flag: '🇸🇹', locale: 'pt-ST' },
  { name: 'Saudi Arabia', code: 'SA', dialCode: '+966', currency: { code: 'SAR', symbol: 'ر.س', name: 'Saudi Riyal' }, flag: '🇸🇦', locale: 'ar-SA' },
  { name: 'Senegal', code: 'SN', dialCode: '+221', currency: { code: 'XOF', symbol: 'CFA', name: 'West African CFA Franc' }, flag: '🇸🇳', locale: 'fr-SN' },
  { name: 'Serbia', code: 'RS', dialCode: '+381', currency: { code: 'RSD', symbol: 'дин', name: 'Serbian Dinar' }, flag: '🇷🇸', locale: 'sr-RS' },
  { name: 'Seychelles', code: 'SC', dialCode: '+248', currency: { code: 'SCR', symbol: '₨', name: 'Seychellois Rupee' }, flag: '🇸🇨', locale: 'en-SC' },
  { name: 'Sierra Leone', code: 'SL', dialCode: '+232', currency: { code: 'SLE', symbol: 'Le', name: 'Sierra Leonean Leone' }, flag: '🇸🇱', locale: 'en-SL' },
  { name: 'Singapore', code: 'SG', dialCode: '+65', currency: { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' }, flag: '🇸🇬', locale: 'en-SG' },
  { name: 'Slovakia', code: 'SK', dialCode: '+421', currency: { code: 'EUR', symbol: '€', name: 'Euro' }, flag: '🇸🇰', locale: 'sk-SK' },
  { name: 'Slovenia', code: 'SI', dialCode: '+386', currency: { code: 'EUR', symbol: '€', name: 'Euro' }, flag: '🇸🇮', locale: 'sl-SI' },
  { name: 'Solomon Islands', code: 'SB', dialCode: '+677', currency: { code: 'SBD', symbol: '$', name: 'Solomon Islands Dollar' }, flag: '🇸🇧', locale: 'en-SB' },
  { name: 'Somalia', code: 'SO', dialCode: '+252', currency: { code: 'SOS', symbol: 'Sh', name: 'Somali Shilling' }, flag: '🇸🇴', locale: 'so-SO' },
  { name: 'South Africa', code: 'ZA', dialCode: '+27', currency: { code: 'ZAR', symbol: 'R', name: 'South African Rand' }, flag: '🇿🇦', locale: 'en-ZA' },
  { name: 'South Korea', code: 'KR', dialCode: '+82', currency: { code: 'KRW', symbol: '₩', name: 'South Korean Won' }, flag: '🇰🇷', locale: 'ko-KR' },
  { name: 'South Sudan', code: 'SS', dialCode: '+211', currency: { code: 'SSP', symbol: '£', name: 'South Sudanese Pound' }, flag: '🇸🇸', locale: 'en-SS' },
  { name: 'Spain', code: 'ES', dialCode: '+34', currency: { code: 'EUR', symbol: '€', name: 'Euro' }, flag: '🇪🇸', locale: 'es-ES' },
  { name: 'Sri Lanka', code: 'LK', dialCode: '+94', currency: { code: 'LKR', symbol: '₨', name: 'Sri Lankan Rupee' }, flag: '🇱🇰', locale: 'si-LK' },
  { name: 'Sudan', code: 'SD', dialCode: '+249', currency: { code: 'SDG', symbol: 'ج.س', name: 'Sudanese Pound' }, flag: '🇸🇩', locale: 'ar-SD' },
  { name: 'Suriname', code: 'SR', dialCode: '+597', currency: { code: 'SRD', symbol: '$', name: 'Surinamese Dollar' }, flag: '🇸🇷', locale: 'nl-SR' },
  { name: 'Sweden', code: 'SE', dialCode: '+46', currency: { code: 'SEK', symbol: 'kr', name: 'Swedish Krona' }, flag: '🇸🇪', locale: 'sv-SE' },
  { name: 'Switzerland', code: 'CH', dialCode: '+41', currency: { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' }, flag: '🇨🇭', locale: 'de-CH' },
  { name: 'Syria', code: 'SY', dialCode: '+963', currency: { code: 'SYP', symbol: '£', name: 'Syrian Pound' }, flag: '🇸🇾', locale: 'ar-SY' },
  { name: 'Taiwan', code: 'TW', dialCode: '+886', currency: { code: 'TWD', symbol: '$', name: 'New Taiwan Dollar' }, flag: '🇹🇼', locale: 'zh-TW' },
  { name: 'Tajikistan', code: 'TJ', dialCode: '+992', currency: { code: 'TJS', symbol: 'ЅМ', name: 'Tajikistani Somoni' }, flag: '🇹🇯', locale: 'tg-TJ' },
  { name: 'Tanzania', code: 'TZ', dialCode: '+255', currency: { code: 'TZS', symbol: 'TSh', name: 'Tanzanian Shilling' }, flag: '🇹🇿', locale: 'sw-TZ' },
  { name: 'Thailand', code: 'TH', dialCode: '+66', currency: { code: 'THB', symbol: '฿', name: 'Thai Baht' }, flag: '🇹🇭', locale: 'th-TH' },
  { name: 'Timor-Leste', code: 'TL', dialCode: '+670', currency: { code: 'USD', symbol: '$', name: 'US Dollar' }, flag: '🇹🇱', locale: 'pt-TL' },
  { name: 'Togo', code: 'TG', dialCode: '+228', currency: { code: 'XOF', symbol: 'CFA', name: 'West African CFA Franc' }, flag: '🇹🇬', locale: 'fr-TG' },
  { name: 'Tonga', code: 'TO', dialCode: '+676', currency: { code: 'TOP', symbol: 'T$', name: 'Tongan Paʻanga' }, flag: '🇹🇴', locale: 'en-TO' },
  { name: 'Trinidad and Tobago', code: 'TT', dialCode: '+1-868', currency: { code: 'TTD', symbol: '$', name: 'Trinidad and Tobago Dollar' }, flag: '🇹🇹', locale: 'en-TT' },
  { name: 'Tunisia', code: 'TN', dialCode: '+216', currency: { code: 'TND', symbol: 'د.ت', name: 'Tunisian Dinar' }, flag: '🇹🇳', locale: 'ar-TN' },
  { name: 'Turkey', code: 'TR', dialCode: '+90', currency: { code: 'TRY', symbol: '₺', name: 'Turkish Lira' }, flag: '🇹🇷', locale: 'tr-TR' },
  { name: 'Turkmenistan', code: 'TM', dialCode: '+993', currency: { code: 'TMT', symbol: 'm', name: 'Turkmenistan Manat' }, flag: '🇹🇲', locale: 'tk-TM' },
  { name: 'Tuvalu', code: 'TV', dialCode: '+688', currency: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' }, flag: '🇹🇻', locale: 'en-TV' },
  { name: 'Uganda', code: 'UG', dialCode: '+256', currency: { code: 'UGX', symbol: 'USh', name: 'Ugandan Shilling' }, flag: '🇺🇬', locale: 'en-UG' },
  { name: 'Ukraine', code: 'UA', dialCode: '+380', currency: { code: 'UAH', symbol: '₴', name: 'Ukrainian Hryvnia' }, flag: '🇺🇦', locale: 'uk-UA' },
  { name: 'United Arab Emirates', code: 'AE', dialCode: '+971', currency: { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' }, flag: '🇦🇪', locale: 'ar-AE' },
  { name: 'United Kingdom', code: 'GB', dialCode: '+44', currency: { code: 'GBP', symbol: '£', name: 'British Pound' }, flag: '🇬🇧', locale: 'en-GB' },
  { name: 'United States', code: 'US', dialCode: '+1', currency: { code: 'USD', symbol: '$', name: 'US Dollar' }, flag: '🇺🇸', locale: 'en-US' },
  { name: 'Uruguay', code: 'UY', dialCode: '+598', currency: { code: 'UYU', symbol: '$', name: 'Uruguayan Peso' }, flag: '🇺🇾', locale: 'es-UY' },
  { name: 'Uzbekistan', code: 'UZ', dialCode: '+998', currency: { code: 'UZS', symbol: "soʻm", name: 'Uzbekistani Soʻm' }, flag: '🇺🇿', locale: 'uz-UZ' },
  { name: 'Vanuatu', code: 'VU', dialCode: '+678', currency: { code: 'VUV', symbol: 'Vt', name: 'Vanuatu Vatu' }, flag: '🇻🇺', locale: 'en-VU' },
  { name: 'Vatican City', code: 'VA', dialCode: '+379', currency: { code: 'EUR', symbol: '€', name: 'Euro' }, flag: '🇻🇦', locale: 'it-VA' },
  { name: 'Venezuela', code: 'VE', dialCode: '+58', currency: { code: 'VES', symbol: 'Bs.', name: 'Venezuelan Bolívar' }, flag: '🇻🇪', locale: 'es-VE' },
  { name: 'Vietnam', code: 'VN', dialCode: '+84', currency: { code: 'VND', symbol: '₫', name: 'Vietnamese Đồng' }, flag: '🇻🇳', locale: 'vi-VN' },
  { name: 'Yemen', code: 'YE', dialCode: '+967', currency: { code: 'YER', symbol: '﷼', name: 'Yemeni Rial' }, flag: '🇾🇪', locale: 'ar-YE' },
  { name: 'Zambia', code: 'ZM', dialCode: '+260', currency: { code: 'ZMW', symbol: 'K', name: 'Zambian Kwacha' }, flag: '🇿🇲', locale: 'en-ZM' },
  { name: 'Zimbabwe', code: 'ZW', dialCode: '+263', currency: { code: 'USD', symbol: '$', name: 'US Dollar' }, flag: '🇿🇼', locale: 'en-ZW' },
];

// Create lookup maps for quick access
export const COUNTRY_BY_CODE: Record<string, Country> = COUNTRIES.reduce((acc, country) => {
  acc[country.code] = country;
  return acc;
}, {} as Record<string, Country>);

export const COUNTRY_BY_DIAL_CODE: Record<string, Country> = COUNTRIES.reduce((acc, country) => {
  acc[country.dialCode] = country;
  return acc;
}, {} as Record<string, Country>);

// Get unique currencies list
export const UNIQUE_CURRENCIES = [...new Set(COUNTRIES.map(c => c.currency.code))].sort();

// Get unique dial codes list
export const DIAL_CODES = COUNTRIES.map(c => ({ 
  code: c.dialCode, 
  country: c.name, 
  flag: c.flag 
})).sort((a, b) => a.code.localeCompare(b.code));

// Currency lookup by code
export const CURRENCY_INFO: Record<string, { code: string; symbol: string; name: string }> = 
  COUNTRIES.reduce((acc, country) => {
    if (!acc[country.currency.code]) {
      acc[country.currency.code] = country.currency;
    }
    return acc;
  }, {} as Record<string, { code: string; symbol: string; name: string }>);

// Timezone to country mapping for auto-detection
export const TIMEZONE_TO_COUNTRY: Record<string, string> = {
  // Africa
  'Africa/Nairobi': 'KE',
  'Africa/Lagos': 'NG',
  'Africa/Cairo': 'EG',
  'Africa/Johannesburg': 'ZA',
  'Africa/Casablanca': 'MA',
  'Africa/Accra': 'GH',
  'Africa/Kampala': 'UG',
  'Africa/Dar_es_Salaam': 'TZ',
  'Africa/Kigali': 'RW',
  'Africa/Addis_Ababa': 'ET',
  'Africa/Algiers': 'DZ',
  'Africa/Tunis': 'TN',
  'Africa/Tripoli': 'LY',
  'Africa/Khartoum': 'SD',
  'Africa/Djibouti': 'DJ',
  'Africa/Asmara': 'ER',
  'Africa/Mogadishu': 'SO',
  'Africa/Bujumbura': 'BI',
  'Africa/Lusaka': 'ZM',
  'Africa/Harare': 'ZW',
  'Africa/Maputo': 'MZ',
  'Africa/Lilongwe': 'MW',
  'Africa/Gaborone': 'BW',
  'Africa/Windhoek': 'NA',
  'Africa/Luanda': 'AO',
  'Africa/Douala': 'CM',
  'Africa/Libreville': 'GA',
  'Africa/Brazzaville': 'CG',
  'Africa/Kinshasa': 'CD',
  'Africa/Bangui': 'CF',
  'Africa/Ndjamena': 'TD',
  'Africa/Abidjan': 'CI',
  'Africa/Ouagadougou': 'BF',
  'Africa/Bamako': 'ML',
  'Africa/Niamey': 'NE',
  'Africa/Dakar': 'SN',
  'Africa/Conakry': 'GN',
  'Africa/Freetown': 'SL',
  'Africa/Monrovia': 'LR',
  'Africa/Banjul': 'GM',
  'Africa/Bissau': 'GW',
  'Africa/Nouakchott': 'MR',
  'Africa/Porto-Novo': 'BJ',
  'Africa/Lome': 'TG',
  
  // Americas
  'America/New_York': 'US',
  'America/Chicago': 'US',
  'America/Denver': 'US',
  'America/Los_Angeles': 'US',
  'America/Anchorage': 'US',
  'America/Toronto': 'CA',
  'America/Vancouver': 'CA',
  'America/Montreal': 'CA',
  'America/Mexico_City': 'MX',
  'America/Sao_Paulo': 'BR',
  'America/Buenos_Aires': 'AR',
  'America/Santiago': 'CL',
  'America/Lima': 'PE',
  'America/Bogota': 'CO',
  'America/Caracas': 'VE',
  'America/Guayaquil': 'EC',
  'America/La_Paz': 'BO',
  'America/Asuncion': 'PY',
  'America/Montevideo': 'UY',
  'America/Jamaica': 'JM',
  'America/Port-au-Prince': 'HT',
  'America/Santo_Domingo': 'DO',
  'America/Havana': 'CU',
  'America/Guatemala': 'GT',
  'America/Tegucigalpa': 'HN',
  'America/Managua': 'NI',
  'America/Panama': 'PA',
  'America/Costa_Rica': 'CR',
  'America/El_Salvador': 'SV',
  'America/Belize': 'BZ',
  
  // Europe
  'Europe/London': 'GB',
  'Europe/Paris': 'FR',
  'Europe/Berlin': 'DE',
  'Europe/Madrid': 'ES',
  'Europe/Rome': 'IT',
  'Europe/Amsterdam': 'NL',
  'Europe/Brussels': 'BE',
  'Europe/Vienna': 'AT',
  'Europe/Warsaw': 'PL',
  'Europe/Moscow': 'RU',
  'Europe/Istanbul': 'TR',
  'Europe/Athens': 'GR',
  'Europe/Stockholm': 'SE',
  'Europe/Oslo': 'NO',
  'Europe/Copenhagen': 'DK',
  'Europe/Helsinki': 'FI',
  'Europe/Dublin': 'IE',
  'Europe/Lisbon': 'PT',
  'Europe/Prague': 'CZ',
  'Europe/Budapest': 'HU',
  'Europe/Bucharest': 'RO',
  'Europe/Zurich': 'CH',
  'Europe/Belgrade': 'RS',
  'Europe/Sofia': 'BG',
  'Europe/Zagreb': 'HR',
  'Europe/Ljubljana': 'SI',
  'Europe/Bratislava': 'SK',
  'Europe/Tallinn': 'EE',
  'Europe/Riga': 'LV',
  'Europe/Vilnius': 'LT',
  'Europe/Kiev': 'UA',
  'Europe/Chisinau': 'MD',
  'Europe/Tirane': 'AL',
  'Europe/Skopje': 'MK',
  'Europe/Podgorica': 'ME',
  'Europe/Sarajevo': 'BA',
  'Europe/Luxembourg': 'LU',
  'Europe/Malta': 'MT',
  'Europe/Nicosia': 'CY',
  'Europe/Reykjavik': 'IS',
  
  // Middle East
  'Asia/Dubai': 'AE',
  'Asia/Riyadh': 'SA',
  'Asia/Kuwait': 'KW',
  'Asia/Qatar': 'QA',
  'Asia/Bahrain': 'BH',
  'Asia/Tehran': 'IR',
  'Asia/Baghdad': 'IQ',
  'Asia/Jerusalem': 'IL',
  'Asia/Beirut': 'LB',
  'Asia/Amman': 'JO',
  'Asia/Damascus': 'SY',
  'Asia/Muscat': 'OM',
  'Asia/Aden': 'YE',
  
  // Asia
  'Asia/Karachi': 'PK',
  'Asia/Kolkata': 'IN',
  'Asia/Dhaka': 'BD',
  'Asia/Kathmandu': 'NP',
  'Asia/Colombo': 'LK',
  'Asia/Bangkok': 'TH',
  'Asia/Singapore': 'SG',
  'Asia/Kuala_Lumpur': 'MY',
  'Asia/Jakarta': 'ID',
  'Asia/Manila': 'PH',
  'Asia/Hong_Kong': 'HK',
  'Asia/Shanghai': 'CN',
  'Asia/Tokyo': 'JP',
  'Asia/Seoul': 'KR',
  'Asia/Taipei': 'TW',
  'Asia/Ho_Chi_Minh': 'VN',
  'Asia/Phnom_Penh': 'KH',
  'Asia/Vientiane': 'LA',
  'Asia/Rangoon': 'MM',
  'Asia/Tashkent': 'UZ',
  'Asia/Almaty': 'KZ',
  'Asia/Bishkek': 'KG',
  'Asia/Dushanbe': 'TJ',
  'Asia/Ashgabat': 'TM',
  'Asia/Yerevan': 'AM',
  'Asia/Tbilisi': 'GE',
  'Asia/Baku': 'AZ',
  'Asia/Afghanistan': 'AF',
  
  // Oceania
  'Australia/Sydney': 'AU',
  'Australia/Melbourne': 'AU',
  'Australia/Brisbane': 'AU',
  'Australia/Perth': 'AU',
  'Australia/Adelaide': 'AU',
  'Pacific/Auckland': 'NZ',
  'Pacific/Fiji': 'FJ',
  'Pacific/Port_Moresby': 'PG',
  'Pacific/Honolulu': 'US',
};

// Detect user's country based on timezone
export function detectCountryFromTimezone(): Country | null {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const countryCode = TIMEZONE_TO_COUNTRY[timezone];
    if (countryCode && COUNTRY_BY_CODE[countryCode]) {
      return COUNTRY_BY_CODE[countryCode];
    }
  } catch {
    // Timezone detection failed
  }
  return null;
}

// Detect user's country using geolocation
export async function detectCountryFromGeolocation(): Promise<Country | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return null;
  }

  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 86400000, // Cache for a day
      });
    });

    const { latitude, longitude } = position.coords;
    
    // Use reverse geocoding to get country
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&zoom=3`
    );
    
    if (response.ok) {
      const data = await response.json();
      const countryCode = data.address?.country_code?.toUpperCase();
      if (countryCode && COUNTRY_BY_CODE[countryCode]) {
        return COUNTRY_BY_CODE[countryCode];
      }
    }
  } catch {
    // Geolocation failed
  }
  
  return null;
}

// Main detection function - tries timezone first, then geolocation
export async function detectUserCountry(): Promise<Country> {
  // First try timezone detection (fast, no permission needed)
  const timezoneCountry = detectCountryFromTimezone();
  if (timezoneCountry) {
    return timezoneCountry;
  }

  // Then try geolocation (requires permission)
  const geoCountry = await detectCountryFromGeolocation();
  if (geoCountry) {
    return geoCountry;
  }

  // Default to Kenya (where Styra is based)
  return COUNTRY_BY_CODE['KE'];
}

// Format price with currency
export function formatPrice(price: number, currencyCode: string, locale?: string): string {
  const currency = CURRENCY_INFO[currencyCode];
  const useLocale = locale || COUNTRY_BY_CODE[Object.keys(COUNTRY_BY_CODE).find(
    code => COUNTRY_BY_CODE[code].currency.code === currencyCode
  ) || 'US']?.locale || 'en-US';
  
  try {
    return new Intl.NumberFormat(useLocale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: currencyCode === 'JPY' || currencyCode === 'KES' ? 0 : 2,
    }).format(price);
  } catch {
    return `${currency?.symbol || '$'}${price.toLocaleString()}`;
  }
}

// Search countries by name or code
export function searchCountries(query: string): Country[] {
  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) return COUNTRIES;
  
  return COUNTRIES.filter(country => 
    country.name.toLowerCase().includes(lowerQuery) ||
    country.code.toLowerCase().includes(lowerQuery) ||
    country.dialCode.includes(query) ||
    country.currency.code.toLowerCase().includes(lowerQuery)
  );
}

// Default export
export default COUNTRIES;
