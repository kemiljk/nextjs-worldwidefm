import { NextResponse } from 'next/server';
import { getFormTexts, getDefaultFormTexts } from '@/lib/form-text-service';

export async function GET() {
  try {
    const formTexts = await getFormTexts();

    if (Object.keys(formTexts).length === 0) {
      return NextResponse.json({
        success: true,
        formTexts: getDefaultFormTexts(),
        usingDefaults: true,
      });
    }

    return NextResponse.json({
      success: true,
      formTexts,
      usingDefaults: false,
    });
  } catch (error) {
    console.error('Error in form-texts API:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        formTexts: getDefaultFormTexts(),
        usingDefaults: true,
      },
      { status: 500 }
    );
  }
}
