const {test,expect}=require('@playwright/test');
test('phone controls, filtering and locked main power',async({page})=>{
 await page.goto('/');await expect(page.getByText('You’re exploring demo mode')).toBeVisible();
 await expect(page.getByRole('switch')).toHaveCount(18);
 const light=page.getByRole('switch',{name:'Living room Reading lamp',exact:true});
 await light.click();await expect(light).toHaveAttribute('aria-checked','true');
 await page.getByRole('button',{name:'All lights on',exact:false}).click();
 await expect(page.locator('#on-count')).toHaveText('18');
 await page.getByRole('button',{name:'Kitchen',exact:true}).click();await expect(page.getByRole('switch')).toHaveCount(3);
 await page.getByRole('button',{name:'All lights off',exact:false}).click();await expect(page.locator('#on-count')).toHaveText('0');
 await expect(page.locator('#main-power')).toBeDisabled();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/mobile.png',fullPage:true});
});

test('rename from phone, cancel, validation and persistence after reload',async({page})=>{
 await page.goto('/');
 const edit=page.getByRole('button',{name:'Rename Living room Reading lamp',exact:true});
 await edit.click();await expect(page.getByRole('dialog',{name:'Rename light'})).toBeVisible();
 await page.getByLabel('Light name',{exact:true}).fill('   ');await page.getByRole('button',{name:'Save name',exact:true}).click();
 await expect(page.locator('#name-error')).toHaveText('Enter a name of 1–40 characters.');
 await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(edit).toBeVisible();
 await edit.click();await page.getByLabel('Light name',{exact:true}).fill('My reading corner');
 await page.getByRole('button',{name:'Save name',exact:true}).click();
 await expect(page.getByRole('switch',{name:'Living room My reading corner',exact:true})).toBeVisible();
 await page.reload();await expect(page.getByRole('switch',{name:'Living room My reading corner',exact:true})).toBeVisible();
 // Restore the initial name so subsequent runs are repeatable.
 await page.getByRole('button',{name:'Rename Living room My reading corner',exact:true}).click();
 await page.getByLabel('Light name',{exact:true}).fill('Reading lamp');await page.getByRole('button',{name:'Save name',exact:true}).click();
 await expect(page.getByRole('switch',{name:'Living room Reading lamp',exact:true})).toBeVisible();
});
