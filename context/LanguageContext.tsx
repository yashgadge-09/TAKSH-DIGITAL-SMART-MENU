"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

type Language = 'en' | 'hi' | 'mr';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const translations: Record<Language, Record<string, string>> = {
  en: {
    ingredients: "Ingredients",
    highlyReordered: "Highly Reordered",
    serves: "Serves",
    people: "people",
    chefNote: "Chef's Note",
    placeOrder: "Add to Cart",
    howDoesItTaste: "How does it taste?",
    mild: "Mild",
    medium: "Medium",
    spicy: "Spicy",
    dishNotFound: "Dish not found",
    loading: "Loading...",
    mostLoved: "Most Loved",
    chefFavourites: "Chef's Favourites",
    trendingToday: "Trending Today",
    moreLikeThis: "More Like This",
    searchPlaceholder: "Search dishes...",
    all: "All",
    starter: "Starter",
    mainCourse: "Main Course",
    beverages: "Beverages",
    dessert: "Dessert",
    sideDish: "Side Dish",
    "Starter": "Starter",
    "Main Course": "Main Course",
    "Beverages": "Beverages",
    "Dessert": "Dessert",
    "Side Dish": "Side Dish",
    "Chef's Special": "Chef's Special",
    "Recommended": "Recommended",
    "Cold Drinks": "Cold Drinks",
    "Breakfast": "Breakfast",
    "Snacks": "Snacks",
    "Juice": "Juice",
    "Coffee": "Coffee",
    "Tea": "Tea",
    "Rice": "Rice",
    "Bread": "Bread",
    "Breads": "Breads",
    "Desserts": "Desserts"
  },
  hi: {
    ingredients: "सामग्री",
    highlyReordered: "अत्यधिक दोबारा ऑर्डर किया गया",
    serves: "परोसता है",
    people: "लोग",
    chefNote: "शेफ की टिप्पणी",
    placeOrder: "कार्ट में जोड़ें",
    howDoesItTaste: "इसका स्वाद कैसा है?",
    mild: "हल्का",
    medium: "मध्यम",
    spicy: "तीखा",
    dishNotFound: "डिश नहीं मिली",
    loading: "लोड हो रहा है...",
    mostLoved: "सबसे ज्यादा पसंद किया गया",
    chefFavourites: "शेफ की पसंद",
    trendingToday: "आज का ट्रेंडिंग",
    moreLikeThis: "इस तरह के और व्यंजन",
    searchPlaceholder: "व्यंजन खोजें...",
    all: "सभी",
    starter: "स्टार्टर",
    mainCourse: "मुख्य भोजन",
    beverages: "पेय",
    dessert: "मीठा",
    sideDish: "साइड डिश",
    "Starter": "स्टार्टर",
    "Main Course": "मुख्य भोजन",
    "Beverages": "पेय",
    "Dessert": "मीठा",
    "Side Dish": "साइड डिश",
    "Chef's Special": "शेफ का विशेष",
    "Recommended": "अनुशंसित",
    "Cold Drinks": "कोल्ड ड्रिंक्स",
    "Breakfast": "नाश्ता",
    "Snacks": "स्नैक्स",
    "Juice": "जूस",
    "Coffee": "कॉफी",
    "Tea": "चाय",
    "Rice": "चावल",
    "Bread": "रोटी",
    "Breads": "रोटियां",
    "Desserts": "मीठा"
  },
  mr: {
    ingredients: "साहित्य",
    highlyReordered: "वारंवार मागवले जाणारे",
    serves: "वाढणी",
    people: "व्यक्ती",
    chefNote: "शेफची टीप",
    placeOrder: "कार्टमध्ये जोडा",
    howDoesItTaste: "याची चव कशी आहे?",
    mild: "सौम्य",
    medium: "मध्यम",
    spicy: "झणझणीत",
    dishNotFound: "पदार्थ सापडला नाही",
    loading: "लोड होत आहे...",
    mostLoved: "सर्वात लोकप्रिय",
    chefFavourites: "शेफचे आवडते",
    trendingToday: "आजचे ट्रेंडिंग",
    moreLikeThis: "यासारखे आणखी पदार्थ",
    searchPlaceholder: "पदार्थ शोधा...",
    all: "सर्व",
    "Starter": "स्टार्टर",
    "Main Course": "मुख्य जेवण",
    "Beverages": "पेय",
    "Dessert": "गोड पदार्थ",
    "Side Dish": "साइड डिश",
    "Chef's Special": "शेफचे वैशिष्ट्य",
    "Recommended": "शिफारस केलेले",
    "Cold Drinks": "थंड पेये",
    "Breakfast": "नाश्ता",
    "Snacks": "स्नॅक्स",
    "Juice": "ज्यूस",
    "Coffee": "कॉफी",
    "Tea": "चहा",
    "Rice": "भात",
    "Bread": "पोळी / भाकरी",
    "Breads": "रोट्या / भाकरी",
    "Desserts": "गोड पदार्थ"
  }
};

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('taksh_lang') as Language;
    if (saved && ['en', 'hi', 'mr'].includes(saved)) {
      setLanguageState(saved);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('taksh_lang', lang);
  };

  const t = (key: string) => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
}
