package com.studyzone.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;

public class StudyZoneContributionsWidgetLarge extends StudyZoneWidgetProvider {
    @Override
    protected String widgetType() {
        return "contributions_large";
    }
}
