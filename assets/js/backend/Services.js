"use strict";

import { M_ } from "./../../../libs-client/M_.js";
import { Shared } from "./../../compiled/Shared.js";

export var Services = {
	completeNameCandidate: function(row_ca, withSociety = false, forceFirstnameFirst = false) {
		// console.log("row_co", row_co);
		if (!row_ca) return "";
		if (row_ca instanceof M_.Model) {
			row_ca = row_ca.getData();
		}
		var res = "";
		// console.log("row_ca", row_ca);
		// console.log("this.getUserRight('persoinvertname')", this.getUserRight('persoinvertname'));
		if (row_ca.ca_name) res += row_ca.ca_name.toUpperCase();
		if (row_ca.ca_firstname && row_ca.ca_name) res += " ";
		if (row_ca.ca_firstname) res += _.capitalize(row_ca.ca_firstname);
		// }
		if (withSociety && !_.isEmpty(row_ca.ca_society)) res += " | " + _.capitalize(row_ca.ca_society);
		return res;
	},
	drawCreatedModified: function(row_co) {
		var html = "";
		if (row_co.createdAt) {
			html += "Créé le " + moment(row_co.createdAt).format("DD/MM/YYYY [à] HH[H]mm");
			if (row_co.createdCo) html += " par " + Shared.completeName(row_co.createdCo);
			html += " - ";
		}
		if (row_co.updatedAt) {
			html += "Modifié le " + moment(row_co.updatedAt).format("DD/MM/YYYY [à] HH[H]mm");
			if (row_co.updatedCo) html += " par " + Shared.completeName(row_co.updatedCo);
		}
		return html;
	},
	displayRight: function(row_co) {
		return _.result(_.find(Shared.getRoles(), { key: row_co.co_type }), "val");
	},
	getUserRight: function(right) {
		return M_.App.Session.co_rights[right];
	},
	getPhraseVacationAcquis: function(who, where) {
		var me = this;
		M_.Utils.getJson("/1.0/vacations/currentinfos/" + who, {}, data => {
			me.updatePhraseVacationAcquis(data.data, where);
		});
	},
	getUserIconInTable: function(user) {
		if (user) {
			if (user instanceof M_.Model) user = user.getData();
			return (
				'<div class="M_ImgRound" style="background-image:url(/1.0/contacts/avatar/30/30/' +
				user.co_id +
				"?d=" +
				moment(user.updatedAt).valueOf() +
				');width:30px;height:30px;"></div>'
			);
		} else return "";
	},
	getColorForCoType: function(co_type) {
		var cls = "";
		if (co_type == "admin") cls += " bg_col7";
		if (co_type == "director") cls += " bg_col3";
		if (co_type == "secretary") cls += " bg_col2";
		if (co_type == "commercial") cls += " bg_col4";
		return cls;
	},

	updatePhraseVacationAcquis: function(data, where) {
		var vacations_pris = data.vacations_pris * 1;
		var vacations_acquis = data.vacations_acquis * 1;
		var vacations_prisn1 = data.vacations_prisn1 * 1;
		var vacations_acquisn1 = data.vacations_acquisn1 * 1;
		var vacations_current = data.vacations_current * 1;
		var vacations_import = data.vacations_import;
		// var reste_n1 = vacations_acquisn1-vacations_prisn1 ;
		// var reste_n = vacations_acquis-vacations_pris ;
		var reste = vacations_acquisn1 + vacations_acquis - (vacations_pris + vacations_prisn1 + vacations_current);

		vacations_prisn1 = vacations_prisn1 + vacations_current;
		if (vacations_prisn1 >= vacations_acquisn1) {
			vacations_pris = vacations_prisn1 - vacations_acquisn1 + vacations_pris;
			vacations_prisn1 = vacations_acquisn1;
			// reste_n = reste_n + reste_n1 ;
			// reste_n1 = 0 ;
			// vacations_prisn1 = 0 ;
		}

		var cls = "";
		var html = "";
		html += "<strong>" + M_.Utils.plural(vacations_acquisn1, "jour</strong> acquis N-1", "jours</strong> acquis n-1") + ", ";
		html += "<strong>" + M_.Utils.plural(vacations_prisn1, "jour</strong> pris N-1", "jours</strong> pris N-1") + ", ";
		html += "<br>";
		html += "<strong>" + M_.Utils.plural(vacations_acquis, "jour</strong> acquis N", "jours</strong> acquis N") + ", ";
		cls = "";
		if (vacations_pris >= vacations_acquis) cls = "txt_col3";
		html +=
			"<strong class='" +
			cls +
			"'>" +
			M_.Utils.plural(vacations_pris, "jour</strong> pris N par anticipation", "jours</strong> pris N par anticipation") +
			", ";
		// html += "<br>" ;
		// html += "<strong>"+M_.Utils.plural(vacations_current, 'jour</strong> en cours', 'jours</strong> en cours')+", " ;
		html += "<br>";
		cls = "";
		if (reste <= 0) cls = "txt_col3";
		if (vacations_pris > 0) html += "reste <strong class='" + cls + "'>" + M_.Utils.plural(reste, "jour") + " par anticipation</strong>";
		else html += "reste <strong class='" + cls + "'>" + M_.Utils.plural(reste - vacations_acquis, "jour") + "</strong>";

		var d = moment(vacations_import);
		// var reste = vacations_gain-vacations_current ;
		// html += ", <strong>"+M_.Utils.plural(vacations_current,'jour</strong> posé','jours</strong> posés')+", reste <strong class='"+cls+"'> "+M_.Utils.plural(reste,'jour')+"</strong> à prendre" ;
		if (d.isValid()) html += " <span class='little'>(maj le " + moment(vacations_import).format("DD/MM/YYYY") + ")</span>";
		where.html(html);
	},
	processAddressesData: function(data) {
		data.ad_googlemap = "https://maps.google.com/?q=";
		var q = "";
		if (data.ad_address1) q += data.ad_address1 + " ";
		if (data.ad_address2) q += data.ad_address2 + " ";
		if (data.ad_address3) q += data.ad_address3 + " ";
		if (data.ad_zip) q += data.ad_zip + " ";
		if (data.ad_city) q += data.ad_city + " ";
		if (data.ad_country) q += data.ad_country + " ";
		data.ad_googlemap += encodeURIComponent(q);
	},
	processContactsData: function(data) {
		// log("data",data)
		if (!data) return;
		var reg1 = /[^\+0-9]/g;
		data.co_tel1_formated = data.co_tel2_formated = data.co_tel3_formated = data.co_mobile1_formated = data.co_mobile2_formated = data.co_mobile3_formated = data.co_fax1_formated = data.co_fax2_formated = data.co_fax3_formated = data.co_tel1_normalized = data.co_tel2_normalized = data.co_fax3_formated = data.co_tel1_normalized = data.co_tel2_normalized = data.co_tel3_normalized = data.co_mobile1_normalized = data.co_mobile2_normalized = data.co_mobile3_normalized = data.co_fax1_normalized = data.co_fax2_normalized = data.co_fax3_normalized =
			"";
		if (data.co_tel1) data.co_tel1_formated = data.co_tel1.replace(reg1, "");
		if (data.co_tel2) data.co_tel2_formated = data.co_tel2.replace(reg1, "");
		if (data.co_tel3) data.co_tel3_formated = data.co_tel3.replace(reg1, "");
		if (data.co_mobile1) data.co_mobile1_formated = data.co_mobile1.replace(reg1, "");
		if (data.co_mobile2) data.co_mobile2_formated = data.co_mobile2.replace(reg1, "");
		if (data.co_mobile3) data.co_mobile3_formated = data.co_mobile3.replace(reg1, "");
		if (data.co_fax1) data.co_fax1_formated = data.co_fax1.replace(reg1, "");
		if (data.co_fax2) data.co_fax2_formated = data.co_fax2.replace(reg1, "");
		if (data.co_fax3) data.co_fax3_formated = data.co_fax3.replace(reg1, "");

		if (data.co_tel1) data.co_tel1_normalized = M_.Utils.formatPhone(data.co_tel1);
		if (data.co_tel2) data.co_tel2_normalized = M_.Utils.formatPhone(data.co_tel2);
		if (data.co_tel3) data.co_tel3_normalized = M_.Utils.formatPhone(data.co_tel3);
		if (data.co_mobile1) data.co_mobile1_normalized = M_.Utils.formatPhone(data.co_mobile1);
		if (data.co_mobile2) data.co_mobile2_normalized = M_.Utils.formatPhone(data.co_mobile2);
		if (data.co_mobile3) data.co_mobile3_normalized = M_.Utils.formatPhone(data.co_mobile3);
		if (data.co_fax1) data.co_fax1_normalized = M_.Utils.formatPhone(data.co_fax1);
		if (data.co_fax2) data.co_fax2_normalized = M_.Utils.formatPhone(data.co_fax2);
		if (data.co_fax3) data.co_fax3_normalized = M_.Utils.formatPhone(data.co_fax3);
	},
	processCandidatesData: function(data) {
		// log("data",data)
		if (!data) return;
		var reg1 = /[^\+0-9]/g;
		data.ca_tel1_formated = data.ca_tel2_formated = data.ca_tel3_formated = data.ca_mobile1_formated = data.ca_mobile2_formated = data.ca_mobile3_formated = data.ca_fax1_formated = data.ca_fax2_formated = data.ca_fax3_formated = data.ca_tel1_normalized = data.ca_tel2_normalized = data.ca_fax3_formated = data.ca_tel1_normalized = data.ca_tel2_normalized = data.ca_tel3_normalized = data.ca_mobile1_normalized = data.ca_mobile2_normalized = data.ca_mobile3_normalized = data.ca_fax1_normalized = data.ca_fax2_normalized = data.ca_fax3_normalized =
			"";
		if (data.ca_tel1) data.ca_tel1_formated = data.ca_tel1.replace(reg1, "");
		if (data.ca_tel2) data.ca_tel2_formated = data.ca_tel2.replace(reg1, "");
		if (data.ca_tel3) data.ca_tel3_formated = data.ca_tel3.replace(reg1, "");
		if (data.ca_mobile1) data.ca_mobile1_formated = data.ca_mobile1.replace(reg1, "");
		if (data.ca_mobile2) data.ca_mobile2_formated = data.ca_mobile2.replace(reg1, "");
		if (data.ca_mobile3) data.ca_mobile3_formated = data.ca_mobile3.replace(reg1, "");
		if (data.ca_fax1) data.ca_fax1_formated = data.ca_fax1.replace(reg1, "");
		if (data.ca_fax2) data.ca_fax2_formated = data.ca_fax2.replace(reg1, "");
		if (data.ca_fax3) data.ca_fax3_formated = data.ca_fax3.replace(reg1, "");

		if (data.ca_tel1) data.ca_tel1_normalized = M_.Utils.formatPhone(data.ca_tel1);
		if (data.ca_tel2) data.ca_tel2_normalized = M_.Utils.formatPhone(data.ca_tel2);
		if (data.ca_tel3) data.ca_tel3_normalized = M_.Utils.formatPhone(data.ca_tel3);
		if (data.ca_mobile1) data.ca_mobile1_normalized = M_.Utils.formatPhone(data.ca_mobile1);
		if (data.ca_mobile2) data.ca_mobile2_normalized = M_.Utils.formatPhone(data.ca_mobile2);
		if (data.ca_mobile3) data.ca_mobile3_normalized = M_.Utils.formatPhone(data.ca_mobile3);
		if (data.ca_fax1) data.ca_fax1_normalized = M_.Utils.formatPhone(data.ca_fax1);
		if (data.ca_fax2) data.ca_fax2_normalized = M_.Utils.formatPhone(data.ca_fax2);
		if (data.ca_fax3) data.ca_fax3_normalized = M_.Utils.formatPhone(data.ca_fax3);
	},
	calculateAugmentationSalary: function(row_ca, formated = true) {
		// console.log("row_ca.ca_salaryproposed, row_ca.ca_salary", row_ca.ca_salaryproposed, row_ca.ca_salary);
		if (row_ca.ca_salary * 1 === 0) return "";
		var p = Math.round((row_ca.ca_salaryproposed * 1 / row_ca.ca_salary * 1 - 1) * 100);
		if (formated) {
			var ret = "";
			if (p >= 0) ret += "+";
			ret += p;
			ret += "%";
			return ret;
		}
		return p;
	},

	// completeAddress: function(row_ad, withLink = false, useBR = true) {
	// 	let lineend = "\n";
	// 	if (useBR) lineend = "<br/>";
	// 	if (row_ad instanceof M_.Model) row_ad = row_ad.getData();
	// 	var html = "";
	// 	if (withLink) {
	// 		var link =
	// 			row_ad.co_address1 +
	// 			" " +
	// 			row_ad.co_address2 +
	// 			" " +
	// 			row_ad.co_address2 +
	// 			" " +
	// 			row_ad.co_zip +
	// 			" " +
	// 			row_ad.co_city +
	// 			" " +
	// 			row_ad.co_country;
	// 		html += '<a href="http://maps.google.com/?q=' + link + "\" target='_blank'>";
	// 	}
	// 	if (row_ad.co_address1) html += "" + row_ad.co_address1 + lineend;
	// 	if (row_ad.co_address2) html += "" + row_ad.co_address2 + lineend;
	// 	if (row_ad.co_address3) html += "" + row_ad.co_address3 + lineend;
	// 	if (row_ad.co_zip || row_ad.co_city || row_ad.co_country)
	// 		html += "" + row_ad.co_zip + " " + row_ad.co_city + " " + row_ad.co_country + lineend;
	// 	if (withLink) html += "</a>";
	// 	return html;
	// },
	drawContact: function() {
		let html = "";
		html += '<div class="M_FlexRow">';
		html += "</div>";
		return html;
	},
	getTabNbHours: function() {
		return [
			{ key: 0, val: " " },
			{ key: 24, val: "24H" },
			{ key: 35, val: "35H" },
			{ key: 375, val: "37,5H" },
			{ key: 38, val: "38H" },
			{ key: 39, val: "39H" }
		];
	},
	getTabSalaryVariable: function() {
		return [{ key: 0, val: " " }, { key: 1, val: "Marge brute" }, { key: 2, val: "Marge semi nette/brute" }, { key: 3, val: "Marge nette" }];
	},
	getTab13Month: function() {
		return [{ key: 0, val: "12 mois" }, { key: 1, val: "13 mois" }, { key: 2, val: "14 mois" }];
	},
	getTabDFS: function() {
		return [{ key: 0, val: " " }, { key: 1, val: "Oui" }, { key: 2, val: "Non" }];
	},
	getTabMeal: function() {
		return [{ key: 0, val: " " }, { key: 1, val: "Oui" }, { key: 2, val: "Non" }];
	},
	getTabInsurance: function() {
		return [{ key: 0, val: " " }, { key: 1, val: "Oui" }, { key: 2, val: "Non" }];
	},
	getTabParticipation: function() {
		return [{ key: 0, val: " " }, { key: 1, val: "Oui" }, { key: 2, val: "Non" }];
	},
	getTabClause: function() {
		return [{ key: 0, val: " " }, { key: 1, val: "Oui" }, { key: 2, val: "Non" }];
	},
	// autres avantages
	// commentaire
	getTabCar: function() {
		return [
			{ key: 0, val: " " },
			{ key: 4, val: "Aucun" },
			{ key: 1, val: "Voiture de fonction" },
			{ key: 2, val: "Voiture de société" },
			{ key: 3, val: "IK" }
		];
	},
	getTabCivility: function() {
		return [
			{ key: "M", val: "M" },
			{ key: "Mme", val: "Mme" },
			{ key: "Mlle", val: "Mlle" },
			{ key: "Dr", val: "Dr" },
			{ key: "Me", val: "Me" },
			{ key: "Pr", val: "Pr" }
		];
	},
	getTabBdd: function() {
		return [{ key: 0, val: " " }, { key: 1, val: "Oui" }, { key: 2, val: "Non" }];
	},
	getTabTypology: function() {
		return [
			{ key: 0, val: " " },
			{ key: 1, val: "Généraliste" },
			{ key: 2, val: "Transport/logistique" },
			{ key: 3, val: "Electricité/logistique" },
			{ key: 4, val: "Industrie" },
			{ key: 5, val: "Informatique" },
			{ key: 6, val: "Menuiserie/mécanique" },
			{ key: 7, val: "BTP" },
			{ key: 8, val: "Plomberie" },
			{ key: 9, val: "Terrasse" }
		];
	},
	getTabPost: function() {
		return [
			// { key: 0, val: ' '},
			{ key: 14, val: "Agent de maintenance" },
			{ key: 1, val: "Assistant(e) administratif" },
			{ key: 3, val: "Assistant(e) d’agence et recrutement" },
			{ key: 2, val: "Assistant(e) RH" },
			{ key: 15, val: "Assistant(e) de gestion" },
			{ key: 4, val: "Chargé(e) d’affaire sédentaire" },
			{ key: 5, val: "Chargé(e) d’affaire junior" },
			{ key: 6, val: "Chargé(e) d’affaire sénior" },
			{ key: 13, val: "Chargé(e) de développement commercial" },
			{ key: 10, val: "Directeur commercial" },
			{ key: 9, val: "Directeur régional" },
			{ key: 11, val: "Informaticien" },
			{ key: 7, val: "Responsable agence" },
			{ key: 12, val: "Responsable commercial et communication" },
			{ key: 8, val: "Responsable de secteur" }
		];
	},
	renderContactsInfo: function(where, data) {
		_.each(data.row_co.contacts, c => {
			Services.processContactsData(c);
			// console.log("c", c);
		});
		_.each(data.row_co.addresses, c => {
			Services.processAddressesData(c);
		});
		M_.App.renderMustacheTo(where, JST["assets/templates/backend/ContactsInfos.html"], data);
	}
};
