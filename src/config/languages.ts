/** Supported annotation language definition. */
export interface AnnotationLanguage {
  /** ISO 639-1 code (e.g., "en", "ja", "zh"). */
  code: string;
  /** English name of the language. */
  name: string;
  /** Native name of the language. */
  nativeName: string;
  /** Instruction text sent to the AI model for this language. */
  instruction: string;
}

/** Built-in annotation language presets. */
export const ANNOTATION_LANGUAGES: readonly AnnotationLanguage[] = [
  { code: 'en', name: 'English', nativeName: 'English', instruction: 'Describe in English.' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', instruction: '请用中文描述。所有文本字段（包括 description 和 annotation_text）都应使用中文。' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', instruction: '日本語で説明してください。description と annotation_text を含む全てのテキストフィールドは日本語で記述してください。' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', instruction: '한국어로 설명해주세요. description과 annotation_text를 포함한 모든 텍스트 필드를 한국어로 작성해주세요.' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', instruction: 'Describe en español. Todos los campos de texto, incluidos description y annotation_text, deben estar en español.' },
  { code: 'fr', name: 'French', nativeName: 'Français', instruction: 'Décrivez en français. Tous les champs de texte, y compris description et annotation_text, doivent être en français.' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', instruction: 'Beschreiben Sie auf Deutsch. Alle Textfelder, einschließlich description und annotation_text, sollten auf Deutsch sein.' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', instruction: 'Descreva em português. Todos os campos de texto, incluindo description e annotation_text, devem estar em português.' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', instruction: 'Опишите на русском языке. Все текстовые поля, включая description и annotation_text, должны быть на русском.' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', instruction: 'صف باللغة العربية. يجب أن تكون جميع حقول النص، بما في ذلك description و annotation_text، باللغة العربية.' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', instruction: 'हिंदी में वर्णन करें। description और annotation_text सहित सभी टेक्स्ट फ़ील्ड हिंदी में होने चाहिए।' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', instruction: 'Descrivi in italiano. Tutti i campi di testo, inclusi description e annotation_text, devono essere in italiano.' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', instruction: 'Beschrijf in het Nederlands. Alle tekstvelden, inclusief description en annotation_text, moeten in het Nederlands zijn.' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', instruction: 'Opisz po polsku. Wszystkie pola tekstowe, w tym description i annotation_text, powinny być po polsku.' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', instruction: 'Türkçe olarak açıklayın. description ve annotation_text dahil tüm metin alanları Türkçe olmalıdır.' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', instruction: 'Mô tả bằng tiếng Việt. Tất cả các trường văn bản, bao gồm description và annotation_text, phải bằng tiếng Việt.' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย', instruction: 'อธิบายเป็นภาษาไทย ฟิลด์ข้อความทั้งหมด รวมถึง description และ annotation_text ควรเป็นภาษาไทย' },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська', instruction: 'Опишіть українською мовою. Усі текстові поля, включаючи description та annotation_text, мають бути українською.' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska', instruction: 'Beskriv på svenska. Alla textfält, inklusive description och annotation_text, ska vara på svenska.' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', instruction: 'Jelaskan dalam bahasa Indonesia. Semua kolom teks, termasuk description dan annotation_text, harus dalam bahasa Indonesia.' },
] as const;

/** Map of language code to AnnotationLanguage for O(1) lookup. */
const languageMap = new Map<string, AnnotationLanguage>(
  ANNOTATION_LANGUAGES.map((lang) => [lang.code, lang]),
);

/**
 * Look up a language by its ISO 639-1 code.
 * Returns undefined if the code is not in the preset list.
 */
export function findLanguage(code: string): AnnotationLanguage | undefined {
  return languageMap.get(code.toLowerCase());
}

/**
 * Get the AI instruction string for a language code.
 * If the code is a known preset, returns the localized instruction.
 * Otherwise, generates a generic instruction using the code as the language name.
 */
export function getLanguageInstruction(code: string): string {
  const lang = findLanguage(code);
  if (lang) return lang.instruction;

  // Fallback: treat the code as a language name for unknown codes
  if (code === 'en') return '';
  return `Respond in ${code}. All text fields including description and annotation_text should be in ${code}.`;
}

/**
 * List all available annotation languages.
 */
export function listLanguages(): readonly AnnotationLanguage[] {
  return ANNOTATION_LANGUAGES;
}
